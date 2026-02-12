const ORDER_CHALLENGES = [
    { question: 'Ordene por numero de seguidores no Instagram (mais -> menos)', items: ['Cristiano Ronaldo', 'Lionel Messi', 'Selena Gomez', 'Kylie Jenner'], correctOrder: [0, 1, 2, 3] },
    { question: 'Ordene por populacao (maior -> menor)', items: ['China', 'India', 'EUA', 'Brasil'], correctOrder: [1, 0, 2, 3] },
    { question: 'Ordene por ano de lancamento (mais antigo -> recente)', items: ['iPhone', 'Facebook', 'YouTube', 'WhatsApp'], correctOrder: [1, 2, 0, 3] },
    { question: 'Ordene por bilheteria mundial (maior -> menor)', items: ['Avatar', 'Vingadores: Ultimato', 'Titanic', 'Star Wars VII'], correctOrder: [0, 1, 2, 3] },
    { question: 'Ordene por area territorial (maior -> menor)', items: ['Russia', 'Canada', 'China', 'Brasil'], correctOrder: [0, 1, 2, 3] },
    { question: 'Ordene por altitude (mais alto -> mais baixo)', items: ['Everest', 'K2', 'Kilimanjaro', 'Mont Blanc'], correctOrder: [0, 1, 2, 3] },
    { question: 'Ordene por ouvintes mensais no Spotify (mais -> menos)', items: ['The Weeknd', 'Taylor Swift', 'Ed Sheeran', 'Bruno Mars'], correctOrder: [0, 1, 3, 2] },
    { question: 'Ordene por numero de Copas do Mundo (mais -> menos)', items: ['Brasil', 'Alemanha', 'Italia', 'Argentina'], correctOrder: [0, 1, 2, 3] },
    { question: 'Ordene por numeros de inscritos no YouTube (mais -> menos)', items: ['MrBeast', 'PewDiePie', 'Cocomelon', 'T-Series'], correctOrder: [3, 0, 2, 1] },
    { question: 'Ordene por duracao (maior -> menor)', items: ['O Senhor dos Aneis: Retorno do Rei', 'Titanic', 'Interestelar', 'Matrix'], correctOrder: [0, 1, 2, 3] },
    { question: 'Ordene por velocidade maxima (mais rapido -> lento)', items: ['Bugatti Chiron', 'Lamborghini Aventador', 'Ferrari LaFerrari', 'Porsche 911 GT3'], correctOrder: [0, 2, 1, 3] },
    { question: 'Ordene por PIB nominal (maior -> menor)', items: ['EUA', 'China', 'Japao', 'Alemanha'], correctOrder: [0, 1, 2, 3] },
];

const TRUE_FALSE_CHALLENGES = [
    {
        question: 'Marque Verdadeiro ou Falso para cada afirmacao:', statements: [
            { text: 'O Sol e uma estrela.', answer: true },
            { text: 'O ser humano tem 206 ossos.', answer: true },
            { text: 'A Grande Muralha da China e visivel do espaco a olho nu.', answer: false },
            { text: 'A agua ferve a 100C ao nivel do mar.', answer: true },
        ],
    },
    {
        question: 'Verdadeiro ou Falso - Fatos Curiosos:', statements: [
            { text: 'Os golfinhos dormem com um olho aberto.', answer: true },
            { text: 'Raios nunca caem duas vezes no mesmo lugar.', answer: false },
            { text: 'O coracao de um camarao fica na cabeca.', answer: true },
            { text: 'O Everest e a montanha mais alta medida da base.', answer: false },
        ],
    },
    {
        question: 'Verdadeiro ou Falso - Historia e Ciencia:', statements: [
            { text: 'Cleopatra viveu mais perto da construcao da pizza do que das piramides.', answer: false },
            { text: 'A luz do Sol leva ~8 minutos para chegar a Terra.', answer: true },
            { text: 'Napoleao Bonaparte era baixo para a epoca dele.', answer: false },
            { text: 'O DNA humano e 99% identico ao de chimpanzes.', answer: true },
        ],
    },
    {
        question: 'Verdadeiro ou Falso - Tecnologia:', statements: [
            { text: 'O primeiro iPhone foi lancado em 2006.', answer: false },
            { text: 'Bitcoin foi criado em 2009.', answer: true },
            { text: 'A Nintendo foi fundada antes da Coca-Cola.', answer: true },
            { text: 'O primeiro computador pesava mais de 27 toneladas.', answer: true },
        ],
    },
    {
        question: 'Verdadeiro ou Falso - Natureza:', statements: [
            { text: 'Os polvos tem tres coracoes.', answer: true },
            { text: 'Os elefantes sao os unicos animais que nao conseguem pular.', answer: false },
            { text: 'A banana e uma fruta e tambem uma baga.', answer: true },
            { text: 'Uma agua-viva e composta por 95% de agua.', answer: true },
        ],
    },
    {
        question: 'Verdadeiro ou Falso - Esportes:', statements: [
            { text: 'O Brasil e o pais com mais titulos de Copa do Mundo.', answer: true },
            { text: 'O basquete foi inventado nos EUA.', answer: false },
            { text: 'Uma partida de tenis pode durar mais de 10 horas.', answer: true },
            { text: 'O golfe ja foi jogado na Lua.', answer: true },
        ],
    },
];

const ESTIMATION_CHALLENGES = [
    { question: 'Quantos paises existem no mundo?', answer: 195, tolerance: 10 },
    { question: 'Qual a altura da Torre Eiffel em metros?', answer: 330, tolerance: 30 },
    { question: 'Em que ano foi fundada a empresa Apple?', answer: 1976, tolerance: 3 },
    { question: 'Quantos ossos tem o corpo humano adulto?', answer: 206, tolerance: 15 },
    { question: 'Qual a velocidade da luz em km/s (arredondado)?', answer: 300000, tolerance: 20000 },
    { question: 'Quantos litros de sangue o corpo humano tem (em media)?', answer: 5, tolerance: 1 },
    { question: 'Em que ano caiu o Muro de Berlim?', answer: 1989, tolerance: 2 },
    { question: 'Qual a distancia da Terra a Lua em km (arredondado)?', answer: 384400, tolerance: 30000 },
    { question: 'Quantas teclas tem um piano padrao?', answer: 88, tolerance: 5 },
    { question: 'Qual o QI medio de um ser humano?', answer: 100, tolerance: 8 },
    { question: 'Quantos estados tem o Brasil?', answer: 26, tolerance: 2 },
    { question: 'Em que ano o homem pisou na Lua pela primeira vez?', answer: 1969, tolerance: 2 },
];

// Chooses one ranking challenge variant for the current round.
function getRandomRanking() {
    const types = ['order', 'true_false', 'estimation'];
    const type = types[Math.floor(Math.random() * types.length)];

    if (type === 'true_false') {
        const challenge = TRUE_FALSE_CHALLENGES[Math.floor(Math.random() * TRUE_FALSE_CHALLENGES.length)];
        return { type: 'true_false', question: challenge.question, statements: challenge.statements };
    }
    if (type === 'estimation') {
        const challenge = ESTIMATION_CHALLENGES[Math.floor(Math.random() * ESTIMATION_CHALLENGES.length)];
        return { type: 'estimation', question: challenge.question, answer: challenge.answer, tolerance: challenge.tolerance };
    }

    const challenge = ORDER_CHALLENGES[Math.floor(Math.random() * ORDER_CHALLENGES.length)];
    return { type: 'order', question: challenge.question, items: challenge.items, correctOrder: challenge.correctOrder };
}

// Counts exact position matches in ordering challenges.
function scoreRanking(playerOrder, correctOrder) {
    let correct = 0;
    for (let index = 0; index < correctOrder.length; index++) {
        if (playerOrder[index] === correctOrder[index]) correct++;
    }
    return correct;
}

module.exports = {
    getRandomRanking,
    scoreRanking,
};
