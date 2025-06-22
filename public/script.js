document.addEventListener('DOMContentLoaded', () => {
    
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

    // --- Estado da Aplicação (sem alterações) ---
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
        tournamentMessage.textContent = ''; // Limpa a mensagem de sucesso
        currentTournamentId = null;
        fetchTournaments();
    });

    function showMainApp(user) {
        currentUser = user;
        authContainer.classList.add('hidden');
        mainContent.classList.remove('hidden');
        userInfo.textContent = `Logado como: ${user.username}`;
        fetchTournaments();
        // startNotificationPolling(); // Descomente se quiser usar notificações
    }

    // --- API: AUTENTICAÇÃO (sem alterações) ---
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
    tournamentList.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('join-btn')) {
            e.stopPropagation();
            const tournamentId = target.dataset.tid;
            joinTournament(tournamentId);
        } 
        else if (target.closest('li')) {
            const tournamentId = target.closest('li').dataset.tid;
            selectTournament(tournamentId);
        }
    });

    // <<<<<<< INÍCIO DA CORREÇÃO NO FRONT-END >>>>>>>
    async function joinTournament(tournamentId) {
        const response = await fetch(`/api/tournaments/${tournamentId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        
        if (response.ok) {
            // SUCESSO! Em vez de recarregar a lista, vamos direto para os detalhes.
            selectTournament(tournamentId);
        } else {
            const result = await response.json();
            tournamentMessage.textContent = result.message;
            tournamentMessage.style.color = 'var(--error-color)';
        }
    }
    // <<<<<<< FIM DA CORREÇÃO NO FRONT-END >>>>>>>

    async function fetchTournaments() {
        const response = await fetch('/api/tournaments');
        const tournaments = await response.json();
        tournamentList.innerHTML = ''; // Limpa a lista antiga
        tournaments.forEach(t => {
            const li = document.createElement('li');
            li.dataset.tid = t.id;

            // Esta verificação agora vai funcionar, pois o back-end envia o formato correto
            const isParticipant = t.participants.some(p => p.id === currentUser.id);

            // A contagem de participantes virá do tamanho do array
            const participantsCount = t.participants.length;

            li.innerHTML = `
                <span><strong>${t.name}</strong> (${t.game}) - ${participantsCount} participante(s)</span>
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
        await fetchTournamentDetails();
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
            fetchTournamentDetails();
        } else {
            matchMessage.textContent = result.message;
            matchMessage.style.color = 'var(--error-color)';
        }
    });

    async function recordResult(matchId) {
        const matchElement = document.getElementById(`match-${matchId}`);
        const p1Id = parseInt(matchElement.dataset.p1);
        const p1Name = matchElement.querySelector('.p1').textContent;
        const p2Id = parseInt(matchElement.dataset.p2);
        const p2Name = matchElement.querySelector('.p2').textContent;

        const winnerSelection = prompt(`Quem venceu a partida?\n1: ${p1Name}\n2: ${p2Name}\nDigite 1 ou 2:`);
        
        let winnerId;
        if (winnerSelection === '1') winnerId = p1Id;
        else if (winnerSelection === '2') winnerId = p2Id;
        else {
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
        
        if (response.ok) fetchTournamentDetails();
        else alert('Erro ao registrar resultado.');
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
                const winnerIsP1 = m.winnerId === m.player1.id;
                content += ` - <strong>Vencedor: ${winnerIsP1 ? m.player1.username : m.player2.username} (${m.score})</strong>`;
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
    
    window.recordResult = recordResult;
});
