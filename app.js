// Global state
let state = {
  settings: {
    potThreshold1: 5000,
    potThreshold2: 3000,
    potThreshold3: 1500,
    bidIncrement: 100,
    currency: 'Plc'
  },
  players: [],
  teams: [],
  auction: {
    isActive: false,
    currentPlayerIndex: -1,
    currentBid: 0,
    currentBidder: null,
    bidHistory: []
  },
  log: [],
  mode: 'host',
  selectedTeam: null
};

// Audio context for sound effects
let audioContext = null;

function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type) {
  initAudio();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  if (type === 'click') {
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.1;
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  } else if (type === 'success') {
    oscillator.frequency.value = 1000;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.15;
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  } else if (type === 'bid') {
    oscillator.frequency.value = 600;
    oscillator.type = 'triangle';
    gainNode.gain.value = 0.12;
    oscillator.start();
    oscillator.frequency.exponentialRampToValueAtTime(900, audioContext.currentTime + 0.15);
    oscillator.stop(audioContext.currentTime + 0.15);
  }
}

// Initialize app
function init() {
  loadState();
  checkMode();
  setupEventListeners();
  updateUI();
}

// Check URL parameters for mode
function checkMode() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mode') === 'bidder') {
    state.mode = 'bidder';
    document.getElementById('bidderModeBtn').click();
  }
}

// Setup event listeners
function setupEventListeners() {
  // Mode selector
  document.getElementById('hostModeBtn').addEventListener('click', () => {
    playSound('click');
    switchMode('host');
  });
  
  document.getElementById('bidderModeBtn').addEventListener('click', () => {
    playSound('click');
    switchMode('bidder');
  });

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      playSound('click');
      const tab = e.target.dataset.tab;
      switchTab(tab);
    });
  });

  // Setup tab
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('copyBidderLink').addEventListener('click', copyBidderLink);

  // Players tab
  document.getElementById('addPlayer').addEventListener('click', addPlayer);

  // Teams tab
  document.getElementById('addTeam').addEventListener('click', addTeam);

  // Log tab
  document.getElementById('exportLog').addEventListener('click', exportLog);
  document.getElementById('clearLog').addEventListener('click', clearAuctionLog);
}

// Switch mode
function switchMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
  
  if (mode === 'host') {
    document.getElementById('hostModeBtn').classList.add('active');
    document.getElementById('hostInterface').style.display = 'block';
    document.getElementById('bidderInterface').style.display = 'none';
  } else {
    document.getElementById('bidderModeBtn').classList.add('active');
    document.getElementById('hostInterface').style.display = 'none';
    document.getElementById('bidderInterface').style.display = 'block';
    renderBidderInterface();
    startBidderPolling();
  }
}

// Switch tab
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(tabName).classList.add('active');
  
  updateUI();
}

// Save settings
function saveSettings() {
  playSound('click');
  state.settings.potThreshold1 = parseInt(document.getElementById('potThreshold1').value);
  state.settings.potThreshold2 = parseInt(document.getElementById('potThreshold2').value);
  state.settings.potThreshold3 = parseInt(document.getElementById('potThreshold3').value);
  state.settings.bidIncrement = parseInt(document.getElementById('bidIncrement').value);
  
  // Reassign pots for all players
  state.players.forEach(player => {
    if (!player.soldTo) {
      player.pot = calculatePot(player.basePrice);
    }
  });
  
  saveState();
  addLog('Settings saved successfully', 'success');
  playSound('success');
  updateUI();
}

// Calculate pot for player
function calculatePot(basePrice) {
  if (basePrice >= state.settings.potThreshold1) return 1;
  if (basePrice >= state.settings.potThreshold2) return 2;
  if (basePrice >= state.settings.potThreshold3) return 3;
  return 4;
}

// Add player
function addPlayer() {
  playSound('click');
  const name = document.getElementById('playerName').value.trim();
  const basePrice = parseInt(document.getElementById('playerBasePrice').value);
  
  if (!name) {
    addLog('Player name is required', 'error');
    return;
  }
  
  const player = {
    id: Date.now(),
    name,
    basePrice,
    pot: calculatePot(basePrice),
    soldTo: null,
    soldPrice: 0,
    status: 'available'
  };
  
  state.players.push(player);
  saveState();
  addLog(`Added player: ${name} (${basePrice} ${state.settings.currency})`, 'success');
  playSound('success');
  
  document.getElementById('playerName').value = '';
  document.getElementById('playerBasePrice').value = '1000';
  
  updateUI();
}

// Delete player
function deletePlayer(playerId) {
  playSound('click');
  const player = state.players.find(p => p.id === playerId);
  
  if (player && player.soldTo) {
    addLog('Cannot delete sold player', 'error');
    return;
  }
  
  state.players = state.players.filter(p => p.id !== playerId);
  saveState();
  addLog(`Deleted player: ${player.name}`, 'warning');
  updateUI();
}

// Add team
function addTeam() {
  playSound('click');
  const name = document.getElementById('teamName').value.trim();
  const budget = parseInt(document.getElementById('teamBudget').value);
  
  if (!name) {
    addLog('Team name is required', 'error');
    return;
  }
  
  const team = {
    id: Date.now(),
    name,
    initialBudget: budget,
    remainingBudget: budget,
    players: []
  };
  
  state.teams.push(team);
  saveState();
  addLog(`Added team: ${name} (Budget: ${budget} ${state.settings.currency})`, 'success');
  playSound('success');
  
  document.getElementById('teamName').value = '';
  document.getElementById('teamBudget').value = '50000';
  
  updateUI();
}

// Delete team
function deleteTeam(teamId) {
  playSound('click');
  const team = state.teams.find(t => t.id === teamId);
  
  if (team && team.players.length > 0) {
    addLog('Cannot delete team with players', 'error');
    return;
  }
  
  state.teams = state.teams.filter(t => t.id !== teamId);
  saveState();
  addLog(`Deleted team: ${team.name}`, 'warning');
  updateUI();
}

// Start auction
function startAuction() {
  playSound('click');
  
  if (state.players.length === 0) {
    addLog('No players available. Add players first.', 'error');
    return;
  }
  
  if (state.teams.length === 0) {
    addLog('No teams available. Add teams first.', 'error');
    return;
  }
  
  state.auction.isActive = true;
  state.auction.currentPlayerIndex = 0;
  
  // Find first unsold player
  while (state.auction.currentPlayerIndex < state.players.length) {
    const player = state.players[state.auction.currentPlayerIndex];
    if (player.status === 'available') {
      state.auction.currentBid = player.basePrice;
      state.auction.currentBidder = null;
      state.auction.bidHistory = [];
      break;
    }
    state.auction.currentPlayerIndex++;
  }
  
  saveState();
  addLog('Auction started', 'success');
  playSound('success');
  updateUI();
}

// Place bid
function placeBid(teamId) {
  playSound('bid');
  const team = state.teams.find(t => t.id === teamId);
  const player = state.players[state.auction.currentPlayerIndex];
  const newBid = state.auction.currentBid + state.settings.bidIncrement;
  
  if (team.remainingBudget < newBid) {
    addLog(`${team.name} has insufficient budget`, 'error');
    return;
  }
  
  state.auction.currentBid = newBid;
  state.auction.currentBidder = teamId;
  state.auction.bidHistory.push({
    teamId,
    teamName: team.name,
    bid: newBid,
    timestamp: new Date().toISOString()
  });
  
  saveState();
  addLog(`${team.name} bid ${newBid} ${state.settings.currency} for ${player.name}`, 'bid');
  updateUI();
}

// Mark player as sold
function markSold() {
  playSound('click');
  const player = state.players[state.auction.currentPlayerIndex];
  
  if (!state.auction.currentBidder) {
    addLog('No bids placed. Mark as unsold or skip.', 'error');
    return;
  }
  
  const team = state.teams.find(t => t.id === state.auction.currentBidder);
  
  player.soldTo = team.id;
  player.soldPrice = state.auction.currentBid;
  player.status = 'sold';
  
  team.players.push(player.id);
  team.remainingBudget -= state.auction.currentBid;
  
  addLog(`${player.name} sold to ${team.name} for ${state.auction.currentBid} ${state.settings.currency}`, 'success');
  playSound('success');
  
  moveToNextPlayer();
}

// Mark player as unsold
function markUnsold() {
  playSound('click');
  const player = state.players[state.auction.currentPlayerIndex];
  player.status = 'unsold';
  
  addLog(`${player.name} marked as unsold`, 'warning');
  moveToNextPlayer();
}

// Skip player
function skipPlayer() {
  playSound('click');
  const player = state.players[state.auction.currentPlayerIndex];
  addLog(`Skipped ${player.name}`, 'info');
  moveToNextPlayer();
}

// Move to next player
function moveToNextPlayer() {
  state.auction.currentPlayerIndex++;
  
  // Find next unsold player
  while (state.auction.currentPlayerIndex < state.players.length) {
    const player = state.players[state.auction.currentPlayerIndex];
    if (player.status === 'available') {
      state.auction.currentBid = player.basePrice;
      state.auction.currentBidder = null;
      state.auction.bidHistory = [];
      saveState();
      updateUI();
      return;
    }
    state.auction.currentPlayerIndex++;
  }
  
  // No more players
  state.auction.isActive = false;
  saveState();
  addLog('Auction completed', 'success');
  playSound('success');
  updateUI();
}

// Copy bidder link
function copyBidderLink() {
  playSound('click');
  const link = `${window.location.origin}${window.location.pathname}?mode=bidder`;
  
  // Try modern clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => {
      addLog('Bidder link copied to clipboard', 'success');
      playSound('success');
    }).catch(() => {
      fallbackCopy(link);
    });
  } else {
    fallbackCopy(link);
  }
}

function fallbackCopy(text) {
  const input = document.getElementById('bidderLinkInput');
  input.value = text;
  input.select();
  input.setSelectionRange(0, 99999);
  
  try {
    document.execCommand('copy');
    addLog('Bidder link copied to clipboard', 'success');
    playSound('success');
  } catch (err) {
    addLog('Failed to copy link. Please copy manually.', 'error');
  }
}

// Bidder interface functions
function selectTeam(teamId) {
  playSound('click');
  state.selectedTeam = teamId;
  saveSelectedTeam();
  renderBidderInterface();
  addLog(`Selected team: ${state.teams.find(t => t.id === teamId).name}`, 'success');
  playSound('success');
}

function placeBidderBid() {
  if (!state.selectedTeam) return;
  placeBid(state.selectedTeam);
}

function startBidderPolling() {
  setInterval(() => {
    if (state.mode === 'bidder') {
      loadState();
      renderBidderInterface();
    }
  }, 2000);
}

// Add log entry
function addLog(message, type = 'info') {
  const entry = {
    message,
    type,
    timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  };
  state.log.push(entry);
  saveState();
  updateUI();
}

// Export log
function exportLog() {
  playSound('click');
  const logText = state.log.map(entry => 
    `[${entry.timestamp}] [${entry.type.toUpperCase()}] ${entry.message}`
  ).join('\n');
  
  const blob = new Blob([logText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auction-log-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  
  addLog('Log exported', 'success');
  playSound('success');
}

// Clear log
function clearAuctionLog() {
  playSound('click');
  if (confirm('Are you sure you want to clear the auction log?')) {
    state.log = [];
    saveState();
    updateUI();
    playSound('success');
  }
}

// Update UI
function updateUI() {
  if (state.mode === 'host') {
    updateSetupUI();
    updatePlayersUI();
    updateTeamsUI();
    updateAuctionUI();
    updateResultsUI();
    updateLogUI();
  } else {
    renderBidderInterface();
  }
}

// Update setup UI
function updateSetupUI() {
  document.getElementById('potThreshold1').value = state.settings.potThreshold1;
  document.getElementById('potThreshold2').value = state.settings.potThreshold2;
  document.getElementById('potThreshold3').value = state.settings.potThreshold3;
  document.getElementById('bidIncrement').value = state.settings.bidIncrement;
  
  const link = `${window.location.origin}${window.location.pathname}?mode=bidder`;
  document.getElementById('bidderLinkInput').value = link;
}

// Update players UI
function updatePlayersUI() {
  const container = document.getElementById('playersContainer');
  
  if (state.players.length === 0) {
    container.innerHTML = '<div class="empty-state">No players added yet. Add your first player above.</div>';
    return;
  }
  
  // Group by pot
  const pots = [1, 2, 3, 4];
  let html = '';
  
  pots.forEach(potNum => {
    const potPlayers = state.players.filter(p => p.pot === potNum);
    if (potPlayers.length > 0) {
      html += `<h3 style="margin-top: var(--space-24); margin-bottom: var(--space-12);">Pot ${potNum}</h3>`;
      html += '<div class="grid">';
      
      potPlayers.forEach(player => {
        html += `
          <div class="player-item">
            <div class="player-info">
              <div class="player-name">${player.name}</div>
              <div class="player-details">
                Base: ${player.basePrice} ${state.settings.currency}
                <span class="pot-badge pot-${player.pot}">Pot ${player.pot}</span>
                ${player.status === 'sold' ? `<span class="status-badge status-sold">Sold</span>` : ''}
                ${player.status === 'unsold' ? `<span class="status-badge status-unsold">Unsold</span>` : ''}
                ${player.soldTo ? `<br>Sold to: ${state.teams.find(t => t.id === player.soldTo)?.name} for ${player.soldPrice} ${state.settings.currency}` : ''}
              </div>
            </div>
            ${!player.soldTo ? `<button class="btn btn-danger" onclick="deletePlayer(${player.id})">Delete</button>` : ''}
          </div>
        `;
      });
      
      html += '</div>';
    }
  });
  
  container.innerHTML = html;
}

// Update teams UI
function updateTeamsUI() {
  const container = document.getElementById('teamsContainer');
  
  if (state.teams.length === 0) {
    container.innerHTML = '<div class="empty-state">No teams added yet. Add your first team above.</div>';
    return;
  }
  
  let html = '<div class="grid">';
  
  state.teams.forEach(team => {
    const spentPercentage = ((team.initialBudget - team.remainingBudget) / team.initialBudget) * 100;
    html += `
      <div class="team-item">
        <div class="team-info">
          <div class="team-name">${team.name}</div>
          <div class="team-details">
            Budget: ${team.remainingBudget} / ${team.initialBudget} ${state.settings.currency}
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${spentPercentage}%"></div>
            </div>
            Players: ${team.players.length}
          </div>
        </div>
        ${team.players.length === 0 ? `<button class="btn btn-danger" onclick="deleteTeam(${team.id})">Delete</button>` : ''}
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// Update auction UI
function updateAuctionUI() {
  const container = document.getElementById('auctionStatusContainer');
  
  if (!state.auction.isActive && state.auction.currentPlayerIndex === -1) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>Auction Not Started</h2>
        <p>Click the button below to start the auction.</p>
        <button class="btn btn-primary" onclick="startAuction()" style="margin-top: var(--space-16);">Start Auction</button>
      </div>
    `;
    return;
  }
  
  if (!state.auction.isActive && state.auction.currentPlayerIndex >= state.players.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>Auction Completed</h2>
        <p>All players have been processed. View results in the Results tab.</p>
      </div>
    `;
    return;
  }
  
  const player = state.players[state.auction.currentPlayerIndex];
  const highestBidder = state.auction.currentBidder ? state.teams.find(t => t.id === state.auction.currentBidder) : null;
  
  let html = `
    <div class="auction-player">
      <h2>${player.name}</h2>
      <div style="margin: var(--space-16) 0;">
        <span class="pot-badge pot-${player.pot}">Pot ${player.pot}</span>
      </div>
      <p style="font-size: var(--font-size-lg); margin-top: var(--space-8);">Base Price: ${player.basePrice} ${state.settings.currency}</p>
      <p style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); margin-top: var(--space-8); color: var(--color-primary);">Current Bid: ${state.auction.currentBid} ${state.settings.currency}</p>
      ${highestBidder ? `<p style="margin-top: var(--space-8);">Highest Bidder: <strong>${highestBidder.name}</strong></p>` : '<p style="margin-top: var(--space-8); color: var(--color-text-secondary);">No bids yet</p>'}
    </div>
    
    <div class="bid-buttons">
  `;
  
  state.teams.forEach(team => {
    const isHighest = state.auction.currentBidder === team.id;
    const canBid = team.remainingBudget >= (state.auction.currentBid + state.settings.bidIncrement);
    html += `
      <button class="team-btn ${isHighest ? 'highest-bidder' : ''}" 
              onclick="placeBid(${team.id})" 
              ${!canBid ? 'disabled' : ''}>
        <div>${team.name}</div>
        <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--space-4);">
          Budget: ${team.remainingBudget} ${state.settings.currency}
        </div>
      </button>
    `;
  });
  
  html += `
    </div>
    
    <div class="auction-controls">
      <button class="btn btn-success" onclick="markSold()">Sold</button>
      <button class="btn btn-danger" onclick="markUnsold()">Unsold</button>
      <button class="btn btn-secondary" onclick="skipPlayer()">Skip</button>
    </div>
  `;
  
  if (state.auction.bidHistory.length > 0) {
    html += `
      <div style="margin-top: var(--space-24);">
        <h3>Bid History</h3>
        <div class="bid-history">
    `;
    
    state.auction.bidHistory.slice().reverse().forEach(bid => {
      html += `
        <div class="bid-history-item">
          ${bid.teamName} - ${bid.bid} ${state.settings.currency}
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

// Update results UI
function updateResultsUI() {
  const container = document.getElementById('resultsContainer');
  
  if (state.teams.length === 0) {
    container.innerHTML = '<div class="empty-state">No teams available.</div>';
    return;
  }
  
  let html = '<div class="grid grid-2">';
  
  state.teams.forEach(team => {
    const teamPlayers = state.players.filter(p => team.players.includes(p.id));
    const totalSpent = team.initialBudget - team.remainingBudget;
    
    html += `
      <div class="card">
        <h3>${team.name}</h3>
        <p style="margin: var(--space-8) 0; color: var(--color-text-secondary);">
          Spent: ${totalSpent} / ${team.initialBudget} ${state.settings.currency}<br>
          Remaining: ${team.remainingBudget} ${state.settings.currency}
        </p>
        <h4 style="margin-top: var(--space-16); margin-bottom: var(--space-8);">Players (${teamPlayers.length})</h4>
    `;
    
    if (teamPlayers.length > 0) {
      html += '<div class="grid">';
      teamPlayers.forEach(player => {
        html += `
          <div style="padding: var(--space-8); background: var(--color-bg-1); border-radius: var(--radius-sm);">
            <div style="font-weight: var(--font-weight-medium);">${player.name}</div>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
              ${player.soldPrice} ${state.settings.currency}
            </div>
          </div>
        `;
      });
      html += '</div>';
    } else {
      html += '<p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">No players</p>';
    }
    
    html += '</div>';
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// Update log UI
function updateLogUI() {
  const container = document.getElementById('logContainer');
  
  if (state.log.length === 0) {
    container.innerHTML = '<div class="empty-state">No log entries yet.</div>';
    return;
  }
  
  let html = '';
  state.log.slice().reverse().forEach(entry => {
    html += `
      <div class="log-entry log-${entry.type}">
        <div class="log-timestamp">${entry.timestamp}</div>
        <div class="log-message">${entry.message}</div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Render bidder interface
function renderBidderInterface() {
  const container = document.getElementById('bidderContent');
  
  // Check if team is selected
  loadSelectedTeam();
  
  if (!state.selectedTeam) {
    // Show team selection
    let html = `
      <h2>Select Your Team</h2>
      <p style="margin: var(--space-16) 0; color: var(--color-text-secondary);">Choose your team to participate in the auction. This selection is permanent.</p>
      <div class="team-selection">
    `;
    
    state.teams.forEach(team => {
      html += `
        <button class="team-selection-btn" onclick="selectTeam(${team.id})">
          <div style="font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold);">${team.name}</div>
          <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--space-4);">
            Budget: ${team.remainingBudget} ${state.settings.currency}
          </div>
        </button>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    return;
  }
  
  // Show auction interface
  const team = state.teams.find(t => t.id === state.selectedTeam);
  
  if (!team) {
    container.innerHTML = '<div class="empty-state">Team not found. Please refresh the page.</div>';
    return;
  }
  
  if (!state.auction.isActive && state.auction.currentPlayerIndex === -1) {
    container.innerHTML = `
      <div class="alert alert-info">
        <strong>Waiting for auction to start...</strong><br>
        The host will start the auction soon.
      </div>
      <div style="margin-top: var(--space-16); padding: var(--space-16); background: var(--color-bg-1); border-radius: var(--radius-base);">
        <h3>Your Team: ${team.name}</h3>
        <p style="color: var(--color-text-secondary); margin-top: var(--space-8);">Budget: ${team.remainingBudget} ${state.settings.currency}</p>
      </div>
    `;
    return;
  }
  
  if (!state.auction.isActive && state.auction.currentPlayerIndex >= state.players.length) {
    container.innerHTML = `
      <div class="alert alert-success">
        <strong>Auction Completed!</strong><br>
        Thank you for participating.
      </div>
      <div style="margin-top: var(--space-16); padding: var(--space-16); background: var(--color-bg-1); border-radius: var(--radius-base);">
        <h3>Your Team: ${team.name}</h3>
        <p style="color: var(--color-text-secondary); margin-top: var(--space-8);">
          Budget Used: ${team.initialBudget - team.remainingBudget} ${state.settings.currency}<br>
          Remaining: ${team.remainingBudget} ${state.settings.currency}<br>
          Players: ${team.players.length}
        </p>
      </div>
    `;
    return;
  }
  
  const player = state.players[state.auction.currentPlayerIndex];
  const isHighestBidder = state.auction.currentBidder === state.selectedTeam;
  const canBid = team.remainingBudget >= (state.auction.currentBid + state.settings.bidIncrement);
  
  let html = `
    <div style="margin-bottom: var(--space-16); padding: var(--space-12); background: var(--color-bg-1); border-radius: var(--radius-base);">
      <strong>Your Team: ${team.name}</strong><br>
      <span style="color: var(--color-text-secondary);">Budget: ${team.remainingBudget} ${state.settings.currency}</span>
    </div>
    
    <div class="auction-player">
      <h2>${player.name}</h2>
      <div style="margin: var(--space-16) 0;">
        <span class="pot-badge pot-${player.pot}">Pot ${player.pot}</span>
      </div>
      <p style="font-size: var(--font-size-lg);">Base Price: ${player.basePrice} ${state.settings.currency}</p>
      <p style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); margin-top: var(--space-8); color: var(--color-primary);">Current Bid: ${state.auction.currentBid} ${state.settings.currency}</p>
    </div>
    
    ${isHighestBidder ? '<div class="alert alert-success" style="margin-top: var(--space-16);">You are the current highest bidder!</div>' : ''}
    
    <button class="btn btn-primary" onclick="placeBidderBid()" 
            ${!canBid ? 'disabled' : ''}
            style="width: 100%; margin-top: var(--space-16); padding: var(--space-16);">
      ${canBid ? `Place Bid (${state.auction.currentBid + state.settings.bidIncrement} ${state.settings.currency})` : 'Insufficient Budget'}
    </button>
  `;
  
  if (state.auction.bidHistory.length > 0) {
    html += `
      <div style="margin-top: var(--space-24);">
        <h3>Recent Bids</h3>
        <div class="bid-history">
    `;
    
    state.auction.bidHistory.slice().reverse().slice(0, 5).forEach(bid => {
      html += `
        <div class="bid-history-item">
          ${bid.teamName} - ${bid.bid} ${state.settings.currency}
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

// Storage functions - using in-memory only due to sandbox restrictions
function saveState() {
  try {
    // Store in variable for session
    window.auctionState = JSON.stringify(state);
  } catch (e) {
    console.log('State saved in memory');
  }
}

function loadState() {
  try {
    if (window.auctionState) {
      state = JSON.parse(window.auctionState);
    }
  } catch (e) {
    console.log('Loading state from memory');
  }
}

function saveSelectedTeam() {
  try {
    window.selectedTeamId = state.selectedTeam;
  } catch (e) {
    console.log('Team selection saved in memory');
  }
}

function loadSelectedTeam() {
  try {
    if (window.selectedTeamId) {
      state.selectedTeam = window.selectedTeamId;
    }
  } catch (e) {
    console.log('Loading team selection from memory');
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', init);