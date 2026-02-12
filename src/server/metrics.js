/* eslint-disable @typescript-eslint/no-require-imports */
const { DEFAULT_DUEL_WIN_POINTS } = require('./config');

// Initializes telemetry counters that are tracked during the whole match.
function createEmptyMetrics() {
    return {
        startedAt: Date.now(),
        triviaRoundsResolved: 0,
        duelRoundsResolved: 0,
        totalRoundDurationMs: 0,
        avgRoundDurationMs: 0,
        totalTriviaAnswers: 0,
        totalTriviaCorrectAnswers: 0,
        triviaAccuracyRate: 0,
        totalTriviaPointsAwarded: 0,
        totalDuelPointsAwarded: 0,
        cardTypeCount: { key: 0, distractor: 0, lost_turn: 0, duel: 0 },
        cardWordImpact: {},
        duelStats: {
            total: 0,
            wins: 0,
            noWinner: 0,
            chooserTimeouts: 0,
            resolvedByTimeout: 0,
            recentOutcomes: [],
        },
        teamStats: {},
        scoringAdjustments: [],
    };
}

function ensureTeamMetric(room, teamId) {
    if (!teamId) return null;
    if (!room.metrics.teamStats[teamId]) {
        room.metrics.teamStats[teamId] = {
            triviaWins: 0,
            duelWins: 0,
            totalWins: 0,
            winRate: 0,
        };
    }
    return room.metrics.teamStats[teamId];
}

function refreshTeamWinRates(room) {
    const totalResolvedContests = Math.max(1, room.metrics.triviaRoundsResolved + room.metrics.duelRoundsResolved);
    for (const [teamId, teamMetric] of Object.entries(room.metrics.teamStats)) {
        const safeMetric = teamMetric || {};
        safeMetric.totalWins = Number(safeMetric.triviaWins || 0) + Number(safeMetric.duelWins || 0);
        safeMetric.winRate = safeMetric.totalWins / totalResolvedContests;
        room.metrics.teamStats[teamId] = safeMetric;
    }
}

function getDeadliestCards(room, topN = 5) {
    const entries = Object.entries(room.metrics.cardWordImpact || {})
        .map(([word, impact]) => ({ word, impact: Number(impact) || 0 }))
        .filter((entry) => entry.impact > 0)
        .sort((a, b) => b.impact - a.impact);
    return entries.slice(0, topN);
}

function buildPublicMetrics(room) {
    const metrics = room.metrics || createEmptyMetrics();
    const teamWinRates = {};
    for (const [teamId, team] of Object.entries(room.teams || {})) {
        const teamMetric = metrics.teamStats?.[teamId] || {};
        teamWinRates[teamId] = {
            triviaWins: Number(teamMetric?.triviaWins || 0),
            duelWins: Number(teamMetric?.duelWins || 0),
            totalWins: Number(teamMetric?.totalWins || 0),
            winRate: Number(teamMetric?.winRate || 0),
            teamName: team?.name || 'Time',
        };
    }

    return {
        startedAt: metrics.startedAt,
        triviaRoundsResolved: Number(metrics.triviaRoundsResolved || 0),
        duelRoundsResolved: Number(metrics.duelRoundsResolved || 0),
        avgRoundDurationMs: Math.round(Number(metrics.avgRoundDurationMs || 0)),
        triviaAccuracyRate: Number(metrics.triviaAccuracyRate || 0),
        totalTriviaPointsAwarded: Number(metrics.totalTriviaPointsAwarded || 0),
        totalDuelPointsAwarded: Number(metrics.totalDuelPointsAwarded || 0),
        cardTypeCount: metrics.cardTypeCount || {},
        deadliestCards: getDeadliestCards(room),
        teamWinRates,
        duelStats: {
            total: Number(metrics.duelStats?.total || 0),
            wins: Number(metrics.duelStats?.wins || 0),
            noWinner: Number(metrics.duelStats?.noWinner || 0),
            chooserTimeouts: Number(metrics.duelStats?.chooserTimeouts || 0),
            resolvedByTimeout: Number(metrics.duelStats?.resolvedByTimeout || 0),
        },
        scoringAdjustments: Array.isArray(metrics.scoringAdjustments)
            ? metrics.scoringAdjustments.slice(-8)
            : [],
    };
}

// Applies lightweight balance adjustments when duel rewards drift too much.
function maybeAutoTuneDuelPoints(room) {
    if (!room.autoBalanceScoring) return;
    const duelStats = room.metrics.duelStats || {};
    const totalDuels = Number(duelStats.total || 0);
    if (totalDuels < 3) return;

    const wins = Number(duelStats.wins || 0);
    const duelWinRate = wins / Math.max(1, totalDuels);
    const duelToTriviaPointsRatio = room.metrics.totalDuelPointsAwarded / Math.max(1, room.metrics.totalTriviaPointsAwarded);
    const current = Number(room.scoring.duelWinPoints || DEFAULT_DUEL_WIN_POINTS);
    let next = current;
    let reason = '';

    if (duelToTriviaPointsRatio > 3.5 && current > 80) {
        next = current - 10;
        reason = 'duel_points_down_ratio';
    } else if (duelWinRate < 0.2 && current < 220) {
        next = current + 10;
        reason = 'duel_points_up_low_winrate';
    } else if (duelWinRate > 0.75 && current > 80) {
        next = current - 10;
        reason = 'duel_points_down_high_winrate';
    }

    if (next !== current) {
        room.scoring.duelWinPoints = next;
        room.metrics.scoringAdjustments.push({
            at: Date.now(),
            previous: current,
            next,
            reason,
        });
        if (room.metrics.scoringAdjustments.length > 12) {
            room.metrics.scoringAdjustments = room.metrics.scoringAdjustments.slice(-12);
        }
    }
}

// Tracks card-level impact to surface "deadliest cards" in dashboards.
function recordCardTelemetry(room, card, impact = 0) {
    if (!room?.metrics || !card) return;
    const type = String(card.type || 'unknown');
    if (!room.metrics.cardTypeCount[type]) room.metrics.cardTypeCount[type] = 0;
    room.metrics.cardTypeCount[type]++;

    const safeImpact = Math.max(0, Number(impact) || 0);
    if (safeImpact <= 0) return;

    const wordKey = String(card.word || type).toUpperCase();
    room.metrics.cardWordImpact[wordKey] = (room.metrics.cardWordImpact[wordKey] || 0) + safeImpact;
}

module.exports = {
    buildPublicMetrics,
    createEmptyMetrics,
    ensureTeamMetric,
    maybeAutoTuneDuelPoints,
    recordCardTelemetry,
    refreshTeamWinRates,
};
