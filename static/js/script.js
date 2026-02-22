// [file name]: static/js/script.js
// [file content begin]
// DOM Elements
const activeSection = document.querySelector('.active-section');
const navLinks = document.querySelectorAll('nav a');
const refreshBtn = document.getElementById('refresh-btn');
const refreshDevicesBtn = document.getElementById('refresh-devices-btn');
const saveSettingsBtn = document.getElementById('save-settings');
const lastUpdateTime = document.getElementById('last-update-time');
const deviceSearch = document.getElementById('device-search');
const scanInterval = document.getElementById('scan-interval');

// Stat Badges Elements
const totalDevicesBadge = document.getElementById('total-devices-badge')?.querySelector('.stat-value');
const onlineDevicesBadge = document.getElementById('online-devices-badge')?.querySelector('.stat-value');
const cutDevicesBadge = document.getElementById('cut-devices-badge')?.querySelector('.stat-value');
const offlineDevicesBadge = document.getElementById('offline-devices-badge')?.querySelector('.stat-value');

// Modal Elements
const confirmModal = document.getElementById('confirm-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
let modalConfirm = document.getElementById('modal-confirm');
const modalCancel = document.getElementById('modal-cancel');
const closeModal = document.querySelectorAll('.close-modal');

// Rename Modal Elements
const renameModal = document.getElementById('rename-modal');
let renameConfirm = document.getElementById('rename-confirm');
const renameCancel = document.getElementById('rename-cancel');
const newHostnameInput = document.getElementById('new-hostname');

// NetCut Modal Elements
const netcutInfoModal = document.getElementById('netcut-info-modal');
const netcutInfoClose = document.getElementById('netcut-info-close');
const netcutViewLogs = document.getElementById('netcut-view-logs');
const netcutHelp = document.getElementById('netcut-help');

// Chart variables
let networkChart;
let chartDatasets = {
    download: [],
    upload: [],
    labels: []
};

// NetCut variables
let netcutStatus = {
    engine_active: false,
    active_cuts: [],
    total_cuts: 0,
    gateway_ip: '--',
    gateway_mac: '--',
    cut_targets: []
};

// Function to format bytes into human-readable format
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0 || bytes === undefined || bytes === null) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Function to format bandwidth (bytes per second)
function formatBandwidth(bytesPerSec) {
    if (bytesPerSec === undefined || bytesPerSec === null) return '0 B/s';
    return formatBytes(bytesPerSec) + '/s';
}

// Function to update dashboard stats - FIXED VERSION
function updateDashboardStats() {
    fetch('/api/stats')
        .then(response => response.json())
        .then(data => {
            console.log('Stats data:', data); // Debug
            
            // Update stat cards di dashboard
            document.getElementById('network-status').textContent = data.netcut_active ? 'NetCut Active' : 'Online';
            document.getElementById('active-devices').textContent = data.active_devices || 0;
            document.getElementById('blocked-devices').textContent = data.blocked_devices || 0;
            document.getElementById('download-stats').textContent = formatBandwidth(data.download_rate);
            document.getElementById('upload-stats').textContent = formatBandwidth(data.upload_rate);
            document.getElementById('local-ip').textContent = data.local_ip || '--';
            document.getElementById('gateway-ip').textContent = data.gateway_ip || '--';
            document.getElementById('interface').textContent = data.interface || '--';
            document.getElementById('netcut-global-status').textContent = data.netcut_active ? 'Active' : 'Inactive';
            document.getElementById('system-hostname').textContent = data.hostname || '--';
            document.getElementById('last-scan-time').textContent = data.last_scan || '--';
            
            if (lastUpdateTime) {
                lastUpdateTime.textContent = data.timestamp || '--';
            }
            
            // Update system info jika ada
            fetch('/api/system-info')
                .then(res => res.json())
                .then(sysData => {
                    document.getElementById('system-platform').textContent = sysData.platform || '--';
                    
                    // Format uptime
                    const uptime = sysData.uptime || 0;
                    const days = Math.floor(uptime / 86400);
                    const hours = Math.floor((uptime % 86400) / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    document.getElementById('system-uptime').textContent = 
                        `${days}d ${hours}h ${minutes}m`;
                })
                .catch(err => console.error('Error fetching system info:', err));
        })
        .catch(error => {
            console.error('Error fetching stats:', error);
            showToast('Error fetching network stats', 'error');
        });
}

// Function to update NetCut status - FIXED VERSION
function updateNetCutStatus() {
    fetch('/api/netcut/status')
        .then(response => response.json())
        .then(data => {
            console.log('NetCut status:', data); // Debug
            netcutStatus = data;
            
            // Update NetCut UI status di dashboard
            const netcutGlobalStatus = document.getElementById('netcut-global-status');
            if (netcutGlobalStatus) {
                netcutGlobalStatus.textContent = data.engine_active ? 'Active' : 'Inactive';
            }
            
            // Update NetCut engine status di section netcut
            const netcutEngineStatus = document.getElementById('netcut-engine-status');
            if (netcutEngineStatus) {
                if (data.engine_active) {
                    netcutEngineStatus.innerHTML = '<i class="fas fa-power-off"></i> NetCut Engine: ACTIVE';
                    netcutEngineStatus.className = 'netcut-status-active';
                } else {
                    netcutEngineStatus.innerHTML = '<i class="fas fa-power-off"></i> NetCut Engine: INACTIVE';
                    netcutEngineStatus.className = 'netcut-status-inactive';
                }
            }
            
            // Update gateway info di netcut section
            document.getElementById('netcut-gateway-ip').textContent = data.gateway_ip || '--';
            document.getElementById('netcut-gateway-mac').textContent = data.gateway_mac || '--';
            document.getElementById('netcut-interface').textContent = data.interface || '--';
            document.getElementById('netcut-local-ip').textContent = data.local_ip || '--';
            
            // Update active cuts count
            const activeCutsCount = document.getElementById('active-cuts-count');
            if (activeCutsCount) {
                activeCutsCount.textContent = data.total_cuts || 0;
            }
            
            // Update active cuts list
            updateActiveCutsList(data.cut_targets || []);
        })
        .catch(error => {
            console.error('Error fetching NetCut status:', error);
        });
}

// Function to update active cuts list
function updateActiveCutsList(cutTargets) {
    const container = document.getElementById('active-cuts-container');
    if (!container) return;
    
    if (cutTargets && cutTargets.length > 0) {
        container.innerHTML = '';
        cutTargets.forEach(target => {
            const cutItem = document.createElement('div');
            cutItem.className = 'cut-item';
            cutItem.innerHTML = `
                <div class="cut-info">
                    <div class="cut-ip">${target.ip}</div>
                    <div class="cut-mac">${target.mac || 'MAC unknown'}</div>
                    <div class="cut-time">Since: ${target.start_time || 'Unknown'}</div>
                </div>
                <button class="btn-restore-cut" data-ip="${target.ip}">
                    <i class="fas fa-wifi"></i> Restore
                </button>
            `;
            container.appendChild(cutItem);
            
            // Add event listener untuk restore button
            cutItem.querySelector('.btn-restore-cut').addEventListener('click', function() {
                const ip = this.getAttribute('data-ip');
                restoreSingleTarget(ip);
            });
        });
    } else {
        container.innerHTML = `
            <div class="no-cuts-message">
                <i class="fas fa-wifi"></i>
                <p>No active internet cuts</p>
            </div>
        `;
    }
}

function restoreSingleTarget(ip) {
    fetch('/api/netcut/restore', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ target_ip: ip })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast(`Internet restored for ${ip}`, 'success');
            updateNetCutStatus();
            updateDeviceList();
            updateDashboardStats();
        } else {
            showToast(data.message || 'Failed to restore', 'error');
        }
    })
    .catch(error => {
        console.error('Error restoring target:', error);
        showToast('Failed to restore internet', 'error');
    });
}

// Function to update traffic chart - FIXED VERSION
function updateTrafficChart() {
    fetch('/api/traffic-history')
        .then(response => response.json())
        .then(data => {
            console.log('Traffic data:', data); // Debug
            
            if (!data.timestamps || data.timestamps.length === 0) {
                return;
            }
            
            const formattedLabels = data.timestamps.map(timestamp => {
                try {
                    const date = new Date(timestamp);
                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                } catch {
                    return timestamp;
                }
            });
            
            // Hitung rates
            const downloadRates = [];
            const uploadRates = [];
            
            for (let i = 1; i < data.download.length; i++) {
                const prevTime = new Date(data.timestamps[i - 1]);
                const currTime = new Date(data.timestamps[i]);
                const timeDiff = (currTime - prevTime) / 1000; // in seconds
                
                const downloadDiff = data.download[i] - data.download[i - 1];
                const uploadDiff = data.upload[i] - data.upload[i - 1];
                
                const downloadRate = timeDiff > 0 ? downloadDiff / timeDiff : 0;
                const uploadRate = timeDiff > 0 ? uploadDiff / timeDiff : 0;
                
                downloadRates.push(downloadRate / 1024); // Convert to KB/s
                uploadRates.push(uploadRate / 1024);
            }
            
            // Duplicate first value untuk alignment
            if (downloadRates.length > 0) {
                downloadRates.unshift(downloadRates[0]);
                uploadRates.unshift(uploadRates[0]);
            }
            
            chartDatasets.labels = formattedLabels;
            chartDatasets.download = downloadRates;
            chartDatasets.upload = uploadRates;
            
            updateChart();
        })
        .catch(error => {
            console.error('Error fetching traffic history:', error);
        });
}

// Function to initialize and update the chart - FIXED VERSION
function updateChart() {
    const ctx = document.getElementById('network-chart');
    if (!ctx) return;
    
    if (networkChart) {
        networkChart.data.labels = chartDatasets.labels;
        networkChart.data.datasets[0].data = chartDatasets.download;
        networkChart.data.datasets[1].data = chartDatasets.upload;
        networkChart.update();
    } else {
        networkChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: chartDatasets.labels,
                datasets: [
                    {
                        label: 'Download (KB/s)',
                        data: chartDatasets.download,
                        borderColor: 'rgba(52, 152, 219, 1)',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Upload (KB/s)',
                        data: chartDatasets.upload,
                        borderColor: 'rgba(46, 204, 113, 1)',
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Speed (KB/s)'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += parseFloat(context.parsed.y).toFixed(2) + ' KB/s';
                                }
                                return label;
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }
}

// Function to update device list - FIXED VERSION
function updateDeviceList() {
    fetch('/api/devices')
        .then(response => response.json())
        .then(data => {
            console.log('Devices data:', data); // Debug
            
            const devicesList = document.getElementById('devices-list');
            if (!devicesList) return;
            
            devicesList.innerHTML = '';
            const searchTerm = deviceSearch ? deviceSearch.value.toLowerCase() : '';
            
            // Update status badges
            let total = 0;
            let online = 0;
            let cut = 0;
            let offline = 0;
            
            data.forEach(device => {
                if (netcutStatus.active_cuts && netcutStatus.active_cuts.includes(device.ip)) {
                    device.status = 'down';
                    device.blocked = true;
                }
            });
            
            // Filter berdasarkan search term
            const filteredDevices = data.filter(device => {
                if (!searchTerm) return true;
                return (device.hostname || '').toLowerCase().includes(searchTerm) ||
                       (device.ip || '').toLowerCase().includes(searchTerm) ||
                       (device.mac || '').toLowerCase().includes(searchTerm);
            });
            
            filteredDevices.forEach(device => {
                const row = document.createElement('tr');
                
                // Hitung statistik
                total++;
                if (netcutStatus.active_cuts && netcutStatus.active_cuts.includes(device.ip)) {
                    cut++;
                } else if (device.blocked) {
                    cut++;
                } else if (device.status === 'up') {
                    online++;
                } else {
                    offline++;
                }
                
                // Status column
                const statusCell = document.createElement('td');
                const statusDiv = document.createElement('div');
                statusDiv.className = 'device-status';
                const statusIndicator = document.createElement('span');
                statusIndicator.className = 'status-indicator';
                let statusText = '';
                
                if (netcutStatus.active_cuts && netcutStatus.active_cuts.includes(device.ip)) {
                    statusIndicator.classList.add('status-netcut');
                    statusText = 'No Internet';
                } else if (device.blocked) {
                    statusIndicator.classList.add('status-blocked');
                    statusText = 'Blocked';
                } else if (device.status === 'up') {
                    statusIndicator.classList.add('status-online');
                    statusText = 'Online';
                } else {
                    statusIndicator.classList.add('status-offline');
                    statusText = 'Offline';
                }
                
                statusDiv.appendChild(statusIndicator);
                statusDiv.appendChild(document.createTextNode(statusText));
                statusCell.appendChild(statusDiv);
                row.appendChild(statusCell);
                
                // Hostname column
                const hostnameCell = document.createElement('td');
                hostnameCell.textContent = device.hostname || 'Unknown';
                row.appendChild(hostnameCell);
                
                // IP column
                const ipCell = document.createElement('td');
                ipCell.textContent = device.ip || '--';
                row.appendChild(ipCell);
                
                // MAC column
                const macCell = document.createElement('td');
                macCell.textContent = device.mac || '--';
                row.appendChild(macCell);
                
                // Last seen column
                const lastSeenCell = document.createElement('td');
                lastSeenCell.textContent = device.last_seen || '--';
                row.appendChild(lastSeenCell);
                
                // Actions column
                const actionsCell = document.createElement('td');
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'device-actions';
                
                // Block/Unblock Button
                const blockBtn = document.createElement('button');
                blockBtn.className = 'action-btn';
                
                if (netcutStatus.active_cuts && netcutStatus.active_cuts.includes(device.ip)) {
                    blockBtn.classList.add('btn-netcut-unblock');
                    blockBtn.innerHTML = '<i class="fas fa-wifi"></i> Restore';
                    blockBtn.addEventListener('click', () => showConfirmModal('unblock', device));
                } else if (device.blocked) {
                    blockBtn.classList.add('btn-netcut-unblock');
                    blockBtn.innerHTML = '<i class="fas fa-wifi"></i> Restore';
                    blockBtn.addEventListener('click', () => showConfirmModal('unblock', device));
                } else {
                    blockBtn.classList.add('btn-netcut-block');
                    blockBtn.innerHTML = '<i class="fas fa-wifi-slash"></i> Cut';
                    blockBtn.addEventListener('click', () => showConfirmModal('block', device));
                }
                
                // Kick Button
                const kickBtn = document.createElement('button');
                kickBtn.className = 'action-btn btn-netcut-kick';
                kickBtn.innerHTML = '<i class="fas fa-power-off"></i> Kick';
                kickBtn.addEventListener('click', () => showConfirmModal('kick', device));
                
                // Rename Button
                const renameBtn = document.createElement('button');
                renameBtn.className = 'action-btn btn-rename';
                renameBtn.innerHTML = '<i class="fas fa-edit"></i> Rename';
                renameBtn.addEventListener('click', () => showRenameModal(device));
                
                actionsDiv.appendChild(blockBtn);
                actionsDiv.appendChild(kickBtn);
                actionsDiv.appendChild(renameBtn);
                actionsCell.appendChild(actionsDiv);
                row.appendChild(actionsCell);
                
                devicesList.appendChild(row);
            });
            
            // Update stat badges
            if (totalDevicesBadge) totalDevicesBadge.textContent = total;
            if (onlineDevicesBadge) onlineDevicesBadge.textContent = online;
            if (cutDevicesBadge) cutDevicesBadge.textContent = cut;
            if (offlineDevicesBadge) offlineDevicesBadge.textContent = offline;
            
            // Update juga di dashboard stats
            document.getElementById('active-devices').textContent = online;
            document.getElementById('blocked-devices').textContent = cut;
        })
        .catch(error => {
            console.error('Error fetching devices:', error);
            showToast('Error fetching device list', 'error');
        });
}

// Function to show confirmation modal
function showConfirmModal(action, device) {
    if (!confirmModal) return;
    
    let title, message;
    
    if (action === 'block') {
        title = 'Cut Internet (NetCut)';
        message = `Cut internet connection for ${device.hostname || device.ip} (${device.ip})?`;
    } else if (action === 'unblock') {
        title = 'Restore Internet';
        message = `Restore internet connection for ${device.hostname || device.ip} (${device.ip})?`;
    } else if (action === 'kick') {
        title = 'Kick Device';
        message = `Temporarily disconnect ${device.hostname || device.ip} (${device.ip}) for 30 seconds?`;
    }
    
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    confirmModal.style.display = 'block';
    
    // Setup confirm button
    const confirmBtn = document.getElementById('modal-confirm');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.addEventListener('click', () => {
        confirmModal.style.display = 'none';
        
        if (action === 'block') {
            fetch('/api/netcut/cut', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_ip: device.ip })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast(`Internet cut for ${device.hostname || device.ip}`, 'success');
                    updateDeviceList();
                    updateDashboardStats();
                    updateNetCutStatus();
                } else {
                    showToast(data.message || 'Failed to cut internet', 'error');
                }
            })
            .catch(err => {
                console.error('Error:', err);
                showToast('Failed to cut internet', 'error');
            });
            
        } else if (action === 'unblock') {
            fetch('/api/netcut/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_ip: device.ip })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast(`Internet restored for ${device.hostname || device.ip}`, 'success');
                    updateDeviceList();
                    updateDashboardStats();
                    updateNetCutStatus();
                } else {
                    showToast(data.message || 'Failed to restore', 'error');
                }
            })
            .catch(err => {
                console.error('Error:', err);
                showToast('Failed to restore internet', 'error');
            });
            
        } else if (action === 'kick') {
            fetch('/api/kick-device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: device.ip })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast(`${device.hostname || device.ip} kicked for 30 seconds`, 'success');
                    updateDeviceList();
                    updateDashboardStats();
                    updateNetCutStatus();
                    
                    setTimeout(() => {
                        updateDeviceList();
                        updateNetCutStatus();
                    }, 31000);
                } else {
                    showToast(data.message || 'Failed to kick', 'error');
                }
            })
            .catch(err => {
                console.error('Error:', err);
                showToast('Failed to kick device', 'error');
            });
        }
    });
}

// Function to show rename modal
function showRenameModal(device) {
    if (!renameModal) return;
    
    renameModal.style.display = 'block';
    newHostnameInput.value = device.hostname || '';
    
    const confirmBtn = document.getElementById('rename-confirm');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.addEventListener('click', () => {
        const newHostname = newHostnameInput.value.trim();
        if (newHostname) {
            renameDevice(device.ip, newHostname);
            renameModal.style.display = 'none';
        } else {
            showToast('Hostname cannot be empty', 'error');
        }
    });
}

// Function to rename a device
function renameDevice(ip, newHostname) {
    fetch('/api/rename-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, newHostname })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            showToast(data.message, 'success');
            updateDeviceList();
        } else {
            showToast(data.message || 'Failed to rename', 'error');
        }
    })
    .catch(err => {
        console.error('Error:', err);
        showToast('Failed to rename device', 'error');
    });
}

// Function to show toast notification
function showToast(message, type = 'info') {
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon;
    switch (type) {
        case 'success': icon = 'fas fa-check-circle'; break;
        case 'error': icon = 'fas fa-exclamation-circle'; break;
        case 'warning': icon = 'fas fa-exclamation-triangle'; break;
        default: icon = 'fas fa-info-circle';
    }
    
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon"><i class="${icon}"></i></span>
            <span>${message}</span>
        </div>
        <span class="toast-close"><i class="fas fa-times"></i></span>
    `;
    
    toastContainer.appendChild(toast);
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Function to refresh all data
function refreshAll() {
    if (refreshBtn) {
        refreshBtn.classList.add('loading');
    }
    
    fetch('/api/scan')
        .then(res => res.json())
        .then(data => {
            console.log('Scan triggered:', data);
            setTimeout(() => {
                updateDashboardStats();
                updateDeviceList();
                updateNetCutStatus();
                updateTrafficChart();
                
                if (refreshBtn) {
                    refreshBtn.classList.remove('loading');
                }
                showToast('Dashboard refreshed', 'success');
            }, 1000);
        })
        .catch(err => {
            console.error('Error:', err);
            if (refreshBtn) {
                refreshBtn.classList.remove('loading');
            }
            showToast('Failed to refresh', 'error');
        });
}

// Function to refresh devices only
function refreshDevices() {
    if (refreshDevicesBtn) {
        refreshDevicesBtn.classList.add('loading');
    }
    
    fetch('/api/scan')
        .then(res => res.json())
        .then(data => {
            console.log('Devices scan triggered:', data);
            setTimeout(() => {
                updateDeviceList();
                updateNetCutStatus();
                
                if (refreshDevicesBtn) {
                    refreshDevicesBtn.classList.remove('loading');
                }
                showToast('Device list refreshed', 'success');
            }, 1000);
        })
        .catch(err => {
            console.error('Error:', err);
            if (refreshDevicesBtn) {
                refreshDevicesBtn.classList.remove('loading');
            }
            showToast('Failed to refresh devices', 'error');
        });
}

// Function to save settings
function saveSettings() {
    if (!scanInterval) return;
    
    const newInterval = parseInt(scanInterval.value);
    if (isNaN(newInterval) || newInterval < 30) {
        showToast('Scan interval must be at least 30 seconds', 'warning');
        return;
    }
    
    fetch('/api/update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_interval: newInterval })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            showToast('Settings saved successfully', 'success');
        } else {
            showToast(data.message || 'Failed to save', 'error');
        }
    })
    .catch(err => {
        console.error('Error:', err);
        showToast('Failed to save settings', 'error');
    });
}

// Navigation functionality
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        navLinks.forEach(navLink => {
            navLink.parentElement.classList.remove('active');
        });
        
        document.querySelectorAll('section').forEach(section => {
            section.classList.remove('active-section');
        });
        
        link.parentElement.classList.add('active');
        
        const targetId = link.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.add('active-section');
            
            if (targetId === 'devices') {
                updateDeviceList();
            } else if (targetId === 'netcut') {
                updateNetCutStatus();
            }
        }
    });
});

// Event listeners
if (refreshBtn) refreshBtn.addEventListener('click', refreshAll);
if (refreshDevicesBtn) refreshDevicesBtn.addEventListener('click', refreshDevices);
if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);
if (deviceSearch) deviceSearch.addEventListener('input', updateDeviceList);

// Modal close buttons
closeModal.forEach(btn => {
    btn.addEventListener('click', function() {
        if (confirmModal) confirmModal.style.display = 'none';
        if (renameModal) renameModal.style.display = 'none';
        if (netcutInfoModal) netcutInfoModal.style.display = 'none';
    });
});

if (modalCancel) {
    modalCancel.addEventListener('click', () => {
        if (confirmModal) confirmModal.style.display = 'none';
    });
}

if (renameCancel) {
    renameCancel.addEventListener('click', () => {
        if (renameModal) renameModal.style.display = 'none';
    });
}

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
        confirmModal.style.display = 'none';
    }
    if (e.target === renameModal) {
        renameModal.style.display = 'none';
    }
    if (e.target === netcutInfoModal) {
        netcutInfoModal.style.display = 'none';
    }
});

// NetCut quick actions
if (document.getElementById('netcut-restore-all')) {
    document.getElementById('netcut-restore-all').addEventListener('click', () => {
        if (confirm('Restore internet for ALL devices?')) {
            fetch('/api/netcut/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast('All internet connections restored', 'success');
                    updateDeviceList();
                    updateDashboardStats();
                    updateNetCutStatus();
                }
            })
            .catch(err => {
                console.error('Error:', err);
                showToast('Failed to restore all', 'error');
            });
        }
    });
}

if (document.getElementById('netcut-test')) {
    document.getElementById('netcut-test').addEventListener('click', () => {
        fetch('/api/netcut/test')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast('NetCut Engine is running', 'info');
                    updateNetCutStatus();
                }
            })
            .catch(err => {
                console.error('Error:', err);
                showToast('NetCut test failed', 'error');
            });
    });
}

if (document.getElementById('netcut-cleanup')) {
    document.getElementById('netcut-cleanup').addEventListener('click', () => {
        if (confirm('Cleanup all NetCut cuts and restore internet?')) {
            fetch('/api/netcut/flush-all')
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        showToast('All cuts cleaned up', 'success');
                        updateDeviceList();
                        updateDashboardStats();
                        updateNetCutStatus();
                    }
                })
                .catch(err => {
                    console.error('Error:', err);
                    showToast('Cleanup failed', 'error');
                });
        }
    });
}

if (netcutHelp) {
    netcutHelp.addEventListener('click', () => {
        if (netcutInfoModal) {
            netcutInfoModal.style.display = 'block';
        }
    });
}

if (netcutInfoClose) {
    netcutInfoClose.addEventListener('click', () => {
        if (netcutInfoModal) {
            netcutInfoModal.style.display = 'none';
        }
    });
}

// Handle mass rename from JSON file
const renameMassBtn = document.getElementById('rename-mass-btn');
const renameMassUpload = document.getElementById('rename-mass-upload');

if (renameMassBtn && renameMassUpload) {
    renameMassBtn.addEventListener('click', () => {
        const file = renameMassUpload.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    processMassRename(jsonData);
                } catch (err) {
                    showToast('Invalid JSON file', 'error');
                }
            };
            reader.readAsText(file);
        } else {
            showToast('Please select a JSON file', 'error');
        }
    });
}

function processMassRename(jsonData) {
    if (!Array.isArray(jsonData)) {
        showToast('JSON must be an array of {ip, newHostname}', 'error');
        return;
    }
    
    fetch('/api/devices')
        .then(res => res.json())
        .then(devices => {
            const validData = [];
            const invalidIPs = [];
            
            jsonData.forEach(item => {
                if (!item.ip || !item.newHostname) return;
                
                const exists = devices.some(d => d.ip === item.ip);
                if (exists) {
                    validData.push({ ip: item.ip, newHostname: item.newHostname });
                } else {
                    invalidIPs.push(item.ip);
                }
            });
            
            if (validData.length > 0) {
                fetch('/api/rename-devices-mass', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(validData)
                })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        showToast(data.message, 'success');
                        updateDeviceList();
                    } else {
                        showToast(data.message || 'Failed to rename', 'error');
                    }
                })
                .catch(err => {
                    console.error('Error:', err);
                    showToast('Failed to rename devices', 'error');
                });
            }
            
            if (invalidIPs.length > 0) {
                showToast(`IPs not found: ${invalidIPs.join(', ')}`, 'warning');
            }
        })
        .catch(err => {
            console.error('Error:', err);
            showToast('Failed to fetch devices', 'error');
        });
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard initializing...');
    
    // Initial updates
    updateDashboardStats();
    updateTrafficChart();
    updateDeviceList();
    updateNetCutStatus();
    
    // Set auto-refresh intervals
    setInterval(() => {
        updateDashboardStats();
        updateTrafficChart();
    }, 10000);
    
    setInterval(() => {
        updateNetCutStatus();
    }, 5000);
    
    setInterval(() => {
        updateDeviceList();
    }, 15000);
    
    // Update current time di footer
    setInterval(() => {
        const currentTimeEl = document.getElementById('current-time');
        if (currentTimeEl) {
            const now = new Date();
            currentTimeEl.textContent = now.toLocaleTimeString();
        }
    }, 1000);
});
// [file content end]