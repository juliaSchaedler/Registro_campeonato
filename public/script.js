// public/script.js (Versão 2.1 - Com o ajuste de "Entrar no Torneio")

document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos ---
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    const authContainer = document.getElementById('authContainer');
    const mainContent = document.getElementById('mainContent');
    const userInfo = document.getElementById('userInfo');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authMessage = document.getElementById('authMessage');
    const regMessage = document.getElementById('regMessage');

    const tournamentsSection = document.getElementById('tournamentsSection');
    const tournamentList = document.getElementById('tournamentList');
    const tournamentMessage = document.getElementById('tournamentMessage');
    const tournamentDetailSection = document.getElementById('tournamentDetailSection');
    const backToListBtn = document.getElementById('backToListBtn');
    
    const detailTournamentName = document.getElementById('detailTournamentName');
    const matchList = document.getElementById('matchList');
    const createMatchForm = document.getElementById('createMatchForm');
    const player1Select = document.getElementById('player1Select');
    const player2Select = document.getElementById('player2Select');
    const matchMessage = document.getElementById('matchMessage');
    const rankingTable = document.getElementById('rankingTable').getElementsByTagName('tbody')[0];
    
    const notificationList = document.getElementById('notificationList');

    // --- Estado da Aplicação ---
    let currentUser = null;
    let currentTournamentId = null;
    let notificationInterval = null;

    // --- LÓGICA DE UI E NAVEGAÇÃO ---
    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginSection.classList.add('hidden');
        registerSection.classList.remove('hidden');
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
    });

    backToListBtn.addEventListener('click', () => {
        tournamentDetailSection.classList.add('hidden');
        tournamentsSection.classList.remove('hidden');
        currentTournamentId = null;
        fetchTournaments(); // Atualiza a lista principal ao voltar
    });

    function showMainApp(user) {
        currentUser = user;
        authContainer.classList.add('hidden');
        mainContent.classList.remove('hidden');
        userInfo.textContent = `Logado como: ${user.username}`;
        fetchTournaments();
        startNotificationPolling();
    }

    // --- API: AUTENTICAÇÃO ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;
        
        const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        if (response.ok) {
            regMessage.textContent = 'Registro bem-sucedido! Faça o login.';
            regMessage.style.color = 'var(--success-color)';
            registerForm.reset();
            showLogin.click();
        } else {
            regMessage.textContent = result.message;
            regMessage.style.color = 'var(--error-color)';
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        const response = await fetch('/api/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        if (response.ok) {
            showMainApp({ id: result.userId, username: result.username });
        } else {
            authMessage.textContent = result.message;
            authMessage.style.color = 'var(--error-color)';
        }
    });

    // --- API: CAMPEONATOS E PARTIDAS ---

    // MODIFICADO: Listener de eventos para a lista de campeonatos.
    // Lida tanto com o clique para entrar no torneio quanto para ver detalhes.
    tournamentList.addEventListener('click', (e) => {
        const target = e.target;
        // Se o clique foi no botão "Entrar"
        if (target.classList.contains('join-btn')) {
            e.stopPropagation(); // Impede que o clique se propague para o <li>
            const tournamentId = target.dataset.tid;
            joinTournament(tournamentId);
        } 
        // Se o clique foi no <li> (mas não no botão), mostra os detalhes
        else if (target.closest('li')) {
            const tournamentId = target.closest('li').dataset.tid;
            selectTournament(tournamentId);
        }
    });

    // ADICIONADO: Função para entrar em um torneio
    async function joinTournament(tournamentId) {
        const response = await fetch(`/api/tournaments/${tournamentId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        const result = await response.json();
        if (response.ok) {
            tournamentMessage.textContent = 'Inscrição realizada com sucesso!';
            tournamentMessage.style.color = 'var(--success-color)';
            fetchTournaments(); // Atualiza a lista para mostrar o botão como "Inscrito"
        } else {
            tournamentMessage.textContent = result.message;
            tournamentMessage.style.color = 'var(--error-color)';
        }
    }

    async function fetchTournaments() {
        const response = await fetch('/api/tournaments');
        const tournaments = await response.json();
        tournamentList.innerHTML = '';
        tournaments.forEach(t => {
            const li = document.createElement('li');
            li.dataset.tid = t.id; // Adiciona o ID ao elemento li para referência

            // Verifica se o usuário atual já está inscrito
            const isParticipant = t.participants.some(p => p.id === currentUser.id);

            // MODIFICADO: O innerHTML agora inclui o botão de forma inteligente
            li.innerHTML = `
                <span><strong>${t.name}</strong> (${t.game}) - ${t.participants.length} participante(s)</span>
                <button class="join-btn" data-tid="${t.id}" ${isParticipant ? 'disabled' : ''}>
                    ${isParticipant ? 'Inscrito' : 'Entrar'}
                </button>
            `;
            tournamentList.appendChild(li);
        });
    }

    async function selectTournament(id) {
        currentTournamentId = id;
        tournamentsSection.classList.add('hidden');
        tournamentDetailSection.classList.remove('hidden');
        fetchTournamentDetails();
    }
    
    async function fetchTournamentDetails() {
        if (!currentTournamentId) return;
        const response = await fetch(`/api/tournaments/${currentTournamentId}`);
        const data = await response.json();
        renderTournamentDetails(data);
    }
    
    createMatchForm.addEventListener('submit', async(e) => {
        e.preventDefault();
        const player1Id = parseInt(player1Select.value);
        const player2Id = parseInt(player2Select.value);

        const response = await fetch(`/api/tournaments/${currentTournamentId}/matches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player1Id, player2Id })
        });

        const result = await response.json();
        if (response.ok) {
            matchMessage.textContent = 'Partida criada com sucesso!';
            matchMessage.style.color = 'var(--success-color)';
            fetchTournamentDetails(); // Re-renderiza tudo
        } else {
            matchMessage.textContent = result.message;
            matchMessage.style.color = 'var(--error-color)';
        }
    });

    async function recordResult(matchId) {
        const matchElement = document.getElementById(`match-${matchId}`);
        const p1Name = matchElement.querySelector('.p1').textContent;
        const p2Name = matchElement.querySelector('.p2').textContent;

        const winnerSelection = prompt(`Quem venceu a partida?\n1: ${p1Name}\n2: ${p2Name}\nDigite 1 ou 2:`);
        
        let winnerId;
        if (winnerSelection === '1') {
            winnerId = parseInt(matchElement.dataset.p1);
        } else if (winnerSelection === '2') {
            winnerId = parseInt(matchElement.dataset.p2);
        } else {
            alert("Seleção inválida.");
            return;
        }

        const score = prompt("Digite o placar final (ex: 2-1):");
        if (!score) return;

        const response = await fetch(`/api/matches/${matchId}/result`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ winnerId, score })
        });
        
        if (response.ok) {
            fetchTournamentDetails();
        } else {
            alert('Erro ao registrar resultado.');
        }
    }

    // --- RENDERIZAÇÃO ---
    function renderTournamentDetails(data) {
        detailTournamentName.textContent = data.name;
        
        matchList.innerHTML = '';
        data.matches.forEach(m => {
            const matchDiv = document.createElement('div');
            matchDiv.className = `match-item ${m.status.toLowerCase()}`;
            matchDiv.id = `match-${m.id}`;
            matchDiv.dataset.p1 = m.player1.id;
            matchDiv.dataset.p2 = m.player2.id;

            let content = `<span class="p1">${m.player1.username}</span> vs <span class="p2">${m.player2.username}</span>`;
            if (m.status === 'Finalizada') {
                const winnerUsername = m.winnerId === m.player1.id ? m.player1.username : m.player2.username;
                content += ` - <strong>Vencedor: ${winnerUsername} (${m.score})</strong>`;
            } else {
                content += ` <button onclick="recordResult(${m.id})">Registrar Resultado</button>`;
            }
            matchDiv.innerHTML = content;
            matchList.appendChild(matchDiv);
        });

        player1Select.innerHTML = '<option value="">Selecione Jogador 1</option>';
        player2Select.innerHTML = '<option value="">Selecione Jogador 2</option>';
        data.participants.forEach(p => {
            player1Select.innerHTML += `<option value="${p.id}">${p.username}</option>`;
            player2Select.innerHTML += `<option value="${p.id}">${p.username}</option>`;
        });

        rankingTable.innerHTML = '';
        data.ranking.forEach((p, index) => {
            const row = rankingTable.insertRow();
            row.innerHTML = `<td>${index + 1}º</td><td>${p.username}</td><td>${p.points}</td>`;
        });
    }

    // --- NOTIFICAÇÕES ---
    async function fetchNotifications() {
        if (!currentUser) return;
        const response = await fetch(`/api/notifications/${currentUser.id}`);
        const notifications = await response.json();
        notifications.forEach(n => {
            const li = document.createElement('li');
            li.textContent = n.message;
            notificationList.prepend(li);
        });
    }
    
    function startNotificationPolling() {
        fetchNotifications();
        if (notificationInterval) clearInterval(notificationInterval);
        notificationInterval = setInterval(fetchNotifications, 10000);
    }
    
    window.recordResult = recordResult;
});
