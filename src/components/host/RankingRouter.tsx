'use client';

import RankingChallenge from './RankingChallenge';
import TrueFalseChallenge from './TrueFalseChallenge';
import EstimationChallenge from './EstimationChallenge';

interface Props {
    rankingData: {
        type?: string;
        question: string;
        items?: string[];
        statements?: { text: string }[];
    };
    onSubmitOrder: (order: number[]) => void;
    onSubmitTrueFalse: (answers: boolean[]) => void;
    onSubmitEstimation: (guess: number) => void;
    winnerName?: string;
}

export default function RankingRouter({
    rankingData,
    onSubmitOrder,
    onSubmitTrueFalse,
    onSubmitEstimation,
    winnerName,
}: Props) {
    const type = rankingData.type || 'order';

    if (type === 'true_false' && rankingData.statements) {
        return (
            <TrueFalseChallenge
                question={rankingData.question}
                statements={rankingData.statements}
                onSubmit={onSubmitTrueFalse}
                winnerName={winnerName}
            />
        );
    }

    if (type === 'estimation') {
        return (
            <EstimationChallenge
                question={rankingData.question}
                onSubmit={onSubmitEstimation}
                winnerName={winnerName}
            />
        );
    }

    // Default: order
    return (
        <RankingChallenge
            key={`${rankingData.question}-${rankingData.items?.join('|')}`}
            question={rankingData.question}
            items={rankingData.items || []}
            onSubmit={onSubmitOrder}
            winnerName={winnerName}
        />
    );
}
