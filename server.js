// server.js (Versão 2.0 - Completa)

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Armazenamento em Memória Aprimorado ---
let users = [];
let tournaments = [
    { 
        id: 1, 
        name: "Campeonato de Valorant", 
        game: "Valorant", 
        participants: [], 
        matches: [] 
    },
    { 
        id: 2, 
        name: "Copa de CS:GO", 
        game: "Counter-Strike", 
        participants: [],
        matches: []
    }
];
let notifications = [];
let nextUserId = 1;
let nextTournamentId = 3;
let nextMatchId = 1;
let nextNotificationId = 1;

// --- Rotas da API REST ---

// == USUÁRIOS ==
app.post('/api/users/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Nome de usuário e senha são obrigatórios.' });
    if (users.find(u => u.username === username)) return res.status(409).json({ message: 'Nome de usuário já existe.' });

    const newUser = { id: nextUserId++, username, password, points: 0 };
    users.push(newUser);
    console.log('Novo usuário registrado:', newUser);
    res.status(201).json({ id: newUser.id, username: newUser.username });
});

app.post('/api/users/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        res.status(200).json({ message: 'Login bem-sucedido!', userId: user.id, username: user.username });
    } else {
        res.status(401).json({ message: 'Credenciais inválidas.' });
    }
});

// == CAMPEONATOS ==
app.get('/api/tournaments', (req, res) => {
    res.status(200).json(tournaments);
});

// GET - Obter detalhes de UM campeonato, incluindo partidas e ranking
app.get('/api/tournaments/:id', (req, res) => {
    const tournamentId = parseInt(req.params.id);
    const tournament = tournaments.find(t => t.id === tournamentId);

    if (!tournament) {
        return res.status(404).json({ message: "Campeonato não encontrado." });
    }

    // Lógica para calcular o ranking
    const ranking = tournament.participants.map(p => {
        let points = 0;
        tournament.matches.forEach(m => {
            if (m.winnerId === p.id) {
                points += 3; // 3 pontos por vitória
            }
        });
        return { userId: p.id, username: p.username, points };
    }).sort((a, b) => b.points - a.points); // Ordena por pontos

    res.status(200).json({ ...tournament, ranking });
});

app.post('/api/tournaments/:id/join', (req, res) => {
    const tournamentId = parseInt(req.params.id);
    const { userId } = req.body;
    const tournament = tournaments.find(t => t.id === tournamentId);
    const user = users.find(u => u.id === userId);

    if (!tournament || !user) return res.status(404).json({ message: 'Campeonato ou usuário não encontrado.' });
    if (tournament.participants.some(p => p.id === userId)) return res.status(409).json({ message: 'Usuário já inscrito.' });
    
    tournament.participants.push({ id: user.id, username: user.username });
    notifications.push({ id: nextNotificationId++, userId, message: `Você se inscreveu no: ${tournament.name}` });
    console.log(`Usuário ${user.username} entrou no torneio ${tournament.name}`);
    res.status(200).json(tournament);
});


// == PARTIDAS ==
// POST - Criar uma nova partida em um campeonato
app.post('/api/tournaments/:id/matches', (req, res) => {
    const tournamentId = parseInt(req.params.id);
    const { player1Id, player2Id } = req.body;

    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) return res.status(404).json({ message: "Campeonato não encontrado." });

    const player1 = users.find(u => u.id === player1Id);
    const player2 = users.find(u => u.id === player2Id);

    if (!player1 || !player2) return res.status(404).json({ message: "Jogador não encontrado." });
    if (player1Id === player2Id) return res.status(400).json({ message: "Os jogadores devem ser diferentes."});

    const newMatch = {
        id: nextMatchId++,
        tournamentId,
        player1: { id: player1.id, username: player1.username },
        player2: { id: player2.id, username: player2.username },
        winnerId: null,
        score: null,
        status: 'Pendente'
    };
    tournament.matches.push(newMatch);

    // Notificar ambos os jogadores
    notifications.push({ id: nextNotificationId++, userId: player1Id, message: `Nova partida criada contra ${player2.username} em ${tournament.name}` });
    notifications.push({ id: nextNotificationId++, userId: player2Id, message: `Nova partida criada contra ${player1.username} em ${tournament.name}` });

    console.log("Nova partida criada:", newMatch);
    res.status(201).json(newMatch);
});

// PUT - Registrar o resultado de uma partida
app.put('/api/matches/:matchId/result', (req, res) => {
    const matchId = parseInt(req.params.matchId);
    const { winnerId, score } = req.body;

    let match, tournament;
    // Encontra a partida e o torneio correspondente
    for (const t of tournaments) {
        const foundMatch = t.matches.find(m => m.id === matchId);
        if (foundMatch) {
            match = foundMatch;
            tournament = t;
            break;
        }
    }

    if (!match) return res.status(404).json({ message: "Partida não encontrada." });
    
    match.winnerId = winnerId;
    match.score = score;
    match.status = 'Finalizada';
    
    // Notificar jogadores sobre o resultado
    const loserId = match.player1.id === winnerId ? match.player2.id : match.player1.id;
    notifications.push({ id: nextNotificationId++, userId: winnerId, message: `Você venceu a partida contra ${users.find(u => u.id === loserId).username} (${score})!` });
    notifications.push({ id: nextNotificationId++, userId: loserId, message: `Você perdeu a partida contra ${users.find(u => u.id === winnerId).username} (${score}).` });

    console.log("Resultado da partida registrado:", match);
    res.status(200).json(match);
});


// == NOTIFICAÇÕES ==
app.get('/api/notifications/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const userNotifications = notifications.filter(n => n.userId === userId && !n.read);
    userNotifications.forEach(n => n.read = true); // Marcar como lidas
    res.status(200).json(userNotifications);
});

// --- Iniciando o Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta http://localhost:${PORT}`);
});
