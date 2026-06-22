let supabase = null;
let currentSession = {
    participants: [],
    currentSpeaker: null,
    history: []
};

document.getElementById('connectBtn').addEventListener('click', initializeSupabase);

async function initializeSupabase() {
    const url = document.getElementById('supabaseUrl').value.trim();
    const key = document.getElementById('supabaseKey').value.trim();

    if (!url || !key) {
        alert('Veuillez entrer l\'URL et la clé API Supabase');
        return;
    }

    try {
        console.log('Tentative de connexion à:', url);
        supabase = window.supabase.createClient(url, key);
        
        const { data, error } = await supabase
            .from('participants')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('Erreur Supabase:', error);
            throw error;
        }
        
        console.log('Connexion réussie!');
        updateConnectionStatus(true);
        loadParticipants();
        alert('Connexion Supabase réussie!');
    } catch (error) {
        console.error('Erreur complète:', error);
        updateConnectionStatus(false);
        alert('Erreur de connexion: ' + error.message + '\n\nVérifiez:\n1. L\'URL Supabase\n2. La clé API\n3. Que la table "participants" existe dans Supabase');
    }
}

function updateConnectionStatus(connected) {
    const badge = document.getElementById('connectionStatus');
    if (connected) {
        badge.textContent = 'Connecté';
        badge.classList.remove('disconnected');
        badge.classList.add('connected');
        document.getElementById('connectBtn').disabled = false;
    } else {
        badge.textContent = 'Déconnecté';
        badge.classList.remove('connected');
        badge.classList.add('disconnected');
    }
}

document.getElementById('addBtn').addEventListener('click', addParticipant);
document.getElementById('participantName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addParticipant();
});

async function addParticipant() {
    const nameInput = document.getElementById('participantName');
    const name = nameInput.value.trim();

    if (!name) {
        alert('Veuillez entrer un nom');
        return;
    }

    const participant = {
        name: name,
        spoken: false,
        active: true
    };

    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('participants')
                .insert([participant])
                .select();
            
            if (error) throw error;
            
            if (data && data[0]) {
                currentSession.participants.push({
                    id: data[0].id,
                    name: data[0].name,
                    spoken: data[0].spoken,
                    active: data[0].active,
                    timestamp: data[0].created_at
                });
            }
        } catch (error) {
            console.error('Erreur insertion:', error);
            alert('Erreur: ' + error.message);
            return;
        }
    } else {
        const newParticipant = {
            id: Date.now(),
            name: name,
            spoken: false,
            active: true,
            timestamp: new Date().toISOString()
        };
        currentSession.participants.push(newParticipant);
    }

    nameInput.value = '';
    renderParticipants();
    updateStats();
}

async function loadParticipants() {
    if (!supabase) return;

    try {
        const { data, error } = await supabase
            .from('participants')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erreur chargement:', error);
            throw error;
        }

        if (data) {
            currentSession.participants = data.map(p => ({
                id: p.id,
                name: p.name,
                spoken: p.spoken || false,
                active: p.active !== false,
                timestamp: p.created_at
            }));
            renderParticipants();
            updateStats();
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors du chargement des participants');
    }
}

async function toggleSpoken(participantId) {
    const participant = currentSession.participants.find(p => p.id === participantId);
    if (!participant) return;

    participant.spoken = !participant.spoken;

    if (supabase) {
        try {
            const { error } = await supabase
                .from('participants')
                .update({ spoken: participant.spoken })
                .eq('id', participantId);
            
            if (error) throw error;
        } catch (error) {
            console.error('Erreur update:', error);
            alert('Erreur: ' + error.message);
            participant.spoken = !participant.spoken;
            return;
        }
    }

    renderParticipants();
    updateStats();
}

async function toggleActive(participantId) {
    const participant = currentSession.participants.find(p => p.id === participantId);
    if (!participant) return;

    participant.active = !participant.active;

    if (supabase) {
        try {
            const { error } = await supabase
                .from('participants')
                .update({ active: participant.active })
                .eq('id', participantId);
            
            if (error) throw error;
        } catch (error) {
            console.error('Erreur update:', error);
            alert('Erreur: ' + error.message);
            participant.active = !participant.active;
            return;
        }
    }

    renderParticipants();
    updateStats();
}

async function deleteParticipant(participantId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce participant?')) return;

    if (supabase) {
        try {
            const { error } = await supabase
                .from('participants')
                .delete()
                .eq('id', participantId);
            
            if (error) throw error;
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Erreur: ' + error.message);
            return;
        }
    }

    currentSession.participants = currentSession.participants.filter(p => p.id !== participantId);
    renderParticipants();
    updateStats();
}

function renderParticipants() {
    const container = document.getElementById('participantsList');
    const showOnlyActive = document.getElementById('showOnlyActive').checked;

    const filteredParticipants = currentSession.participants.filter(p => {
        return !showOnlyActive || p.active;
    });

    if (filteredParticipants.length === 0) {
        container.innerHTML = '<p class="empty-state">Aucun participant pour le moment</p>';
        return;
    }

    container.innerHTML = filteredParticipants.map(p => `
        <div class="participant-item ${p.spoken ? 'spoken' : ''}">
            <div class="participant-info">
                <div class="participant-name">${escapeHtml(p.name)}</div>
                <span class="participant-status ${p.spoken ? 'spoken' : 'remaining'}">
                    ${p.spoken ? 'Parlé' : 'Restant'}
                </span>
                ${!p.active ? '<span class="participant-status" style="background:#ddd;color:#666;margin-left:8px;">Inactif</span>' : ''}
            </div>
            <div class="participant-actions">
                <button class="btn btn-small btn-${p.spoken ? 'warning' : 'success'}" 
                    onclick="toggleSpoken(${p.id})">
                    ${p.spoken ? 'Réinitialiser' : 'Parlé'}
                </button>
                <button class="btn btn-small btn-info" 
                    onclick="toggleActive(${p.id})">
                    ${p.active ? 'Désactiver' : 'Activer'}
                </button>
                <button class="btn btn-small btn-danger" 
                    onclick="deleteParticipant(${p.id})">
                    X
                </button>
            </div>
        </div>
    `).join('');
}

function updateStats() {
    const active = currentSession.participants.filter(p => p.active);
    const spoken = active.filter(p => p.spoken);
    const remaining = active.filter(p => !p.spoken);

    document.getElementById('totalParticipants').textContent = active.length;
    document.getElementById('spokedCount').textContent = spoken.length;
    document.getElementById('remainingCount').textContent = remaining.length;
}

document.getElementById('showOnlyActive').addEventListener('change', renderParticipants);

document.getElementById('drawBtn').addEventListener('click', drawParticipant);

function drawParticipant() {
    const active = currentSession.participants.filter(p => p.active);
    const remaining = active.filter(p => !p.spoken);

    if (remaining.length === 0) {
        if (active.length === 0) {
            alert('Aucun participant actif!');
        } else {
            alert('Tous les participants actifs ont parlé!');
        }
        document.getElementById('currentSpeaker').innerHTML = '<p>Aucun participant restant</p>';
        document.getElementById('currentSpeaker').classList.remove('active');
        return;
    }

    const selected = remaining[Math.floor(Math.random() * remaining.length)];
    currentSession.currentSpeaker = selected;

    const speakerDiv = document.getElementById('currentSpeaker');
    speakerDiv.innerHTML = `<div class="name">${escapeHtml(selected.name)}</div>`;
    speakerDiv.classList.add('active');

    currentSession.history.unshift({
        name: selected.name,
        timestamp: new Date().toLocaleTimeString('fr-FR')
    });

    updateHistory();
}

document.getElementById('markAsSpokenBtn').addEventListener('click', markAsSpoken);

function markAsSpoken() {
    if (!currentSession.currentSpeaker) {
        alert('Veuillez d\'abord tirer un participant!');
        return;
    }

    const speaker = currentSession.currentSpeaker;
    const participant = currentSession.participants.find(p => p.id === speaker.id);
    
    if (participant) {
        participant.spoken = true;
        
        if (supabase) {
            supabase
                .from('participants')
                .update({ spoken: true })
                .eq('id', participant.id)
                .then(() => {
                    console.log('Mise à jour sur Supabase');
                })
                .catch(error => console.log('Erreur:', error));
        }
    }

    renderParticipants();
    updateStats();

    const active = currentSession.participants.filter(p => p.active);
    const remaining = active.filter(p => !p.spoken);

    if (remaining.length === 0) {
        document.getElementById('currentSpeaker').innerHTML = '<p>Tous ont parlé!</p>';
    } else {
        document.getElementById('currentSpeaker').innerHTML = '<p>Prêt pour le prochain tirage</p>';
    }

    document.getElementById('currentSpeaker').classList.remove('active');
    currentSession.currentSpeaker = null;
}

document.getElementById('resetBtn').addEventListener('click', resetSession);

function resetSession() {
    if (!confirm('Réinitialiser la session? Tous les statuts "parlé" seront annulés.')) return;

    currentSession.participants.forEach(p => {
        p.spoken = false;
        
        if (supabase) {
            supabase
                .from('participants')
                .update({ spoken: false })
                .eq('id', p.id)
                .catch(error => console.log('Erreur:', error));
        }
    });

    currentSession.currentSpeaker = null;
    currentSession.history = [];

    document.getElementById('currentSpeaker').innerHTML = '<p>Session réinitialisée</p>';
    document.getElementById('currentSpeaker').classList.remove('active');

    renderParticipants();
    updateStats();
    updateHistory();
}

function updateHistory() {
    const historyList = document.getElementById('historyList');
    if (currentSession.history.length === 0) {
        historyList.innerHTML = '<li>Aucun tirage pour le moment</li>';
        return;
    }

    historyList.innerHTML = currentSession.history
        .slice(0, 20)
        .map((item, index) => `
            <li><strong>#${index + 1}</strong> - ${escapeHtml(item.name)} (${item.timestamp})</li>
        `).join('');
}

document.getElementById('exportBtn').addEventListener('click', exportData);

function exportData() {
    const data = {
        participants: currentSession.participants,
        history: currentSession.history,
        exportDate: new Date().toISOString()
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `participants-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    alert('Données exportées avec succès!');
}

document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            currentSession.participants = data.participants || [];
            currentSession.history = data.history || [];
            renderParticipants();
            updateStats();
            updateHistory();
            alert('Données importées avec succès!');
        } catch (error) {
            alert('Erreur lors de l\'import: ' + error.message);
        }
    };
    reader.readAsText(file);
});

document.getElementById('clearAllBtn').addEventListener('click', () => {
    if (!confirm('Êtes-vous sûr? Cette action est irréversible!')) return;

    currentSession.participants = [];
    currentSession.history = [];
    currentSession.currentSpeaker = null;

    if (supabase) {
        supabase
            .from('participants')
            .delete()
            .neq('id', 0)
            .catch(error => console.log('Erreur:', error));
    }

    renderParticipants();
    updateStats();
    updateHistory();
    document.getElementById('currentSpeaker').innerHTML = '<p>Tout effacé</p>';
    document.getElementById('currentSpeaker').classList.remove('active');
    alert('Tout a été effacé!');
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    renderParticipants();
    updateStats();
    updateHistory();
    updateConnectionStatus(false);
});
