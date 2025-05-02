// DOM Elements
const activeSection = document.querySelector('.active-section');
const navLinks = document.querySelectorAll('nav a');
const refreshBtn = document.getElementById('refresh-btn');
const refreshDevicesBtn = document.getElementById('refresh-devices-btn');
const saveSettingsBtn = document.getElementById('save-settings');
const lastUpdateTime = document.getElementById('last-update-time');
const deviceSearch = document.getElementById('device-search');
const scanInterval = document.getElementById('scan-interval');

// Modal Elements
const confirmModal = document.getElementById('confirm-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
let modalConfirm = document.getElementById('modal-confirm'); // gunakan let agar bisa diassign ulang
const modalCancel = document.getElementById('modal-cancel');
const closeModal = document.querySelector('.close-modal');

// Rename Modal Elements
const renameModal = document.getElementById('rename-modal');
let renameConfirm = document.getElementById('rename-confirm'); // ubah dari const ke let
const renameCancel = document.getElementById('rename-cancel');
const newHostnameInput = document.getElementById('new-hostname');

// Chart variables
let networkChart;
let exportData = {};
let chartDatasets = {
    download: [],
    upload: [],
    labels: []
};

// Function to format bytes into human-readable format
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Function to format bandwidth (bytes per second)
function formatBandwidth(bytesPerSec) {
    return formatBytes(bytesPerSec) + '/s';
}

// Function to update dashboard stats
function updateDashboardStats() {
    fetch('/api/stats')
        .then(response => response.json())
        .then(data => {
            document.getElementById('network-status').textContent = 'Online';
            document.getElementById('active-devices').textContent = data.active_devices;
            document.getElementById('blocked-devices').textContent = data.blocked_devices || 0;
            document.getElementById('download-stats').textContent = formatBandwidth(data.download_rate);
            document.getElementById('upload-stats').textContent = formatBandwidth(data.upload_rate);
            document.getElementById('local-ip').textContent = data.local_ip;
            document.getElementById('gateway-ip').textContent = data.gateway_ip;
            document.getElementById('interface').textContent = data.interface;
            lastUpdateTime.textContent = data.timestamp;
        })
        .catch(error => {
            console.error('Error fetching stats:', error);
            showToast('Error fetching network stats', 'error');
        });
}

// Function to update traffic chart
function updateTrafficChart() {
    fetch('/api/traffic-history')
        .then(response => response.json())
        .then(data => {
            const formattedLabels = data.timestamps.map(timestamp => {
                const date = new Date(timestamp);
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            });
            const downloadRates = [];
            const uploadRates = [];
            for (let i = 1; i < data.download.length; i++) {
                const prevTime = new Date(data.timestamps[i - 1]);
                const currTime = new Date(data.timestamps[i]);
                const timeDiff = (currTime - prevTime) / 1000;
                const downloadRate = (data.download[i] - data.download[i - 1]) / timeDiff;
                const uploadRate = (data.upload[i] - data.upload[i - 1]) / timeDiff;
                downloadRates.push(downloadRate / 1024);
                uploadRates.push(uploadRate / 1024);
            }
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

// Function to initialize and update the chart
function updateChart() {
    const ctx = document.getElementById('network-chart').getContext('2d');
    if (networkChart) {
        networkChart.data.labels = chartDatasets.labels;
        networkChart.data.datasets[0].data = chartDatasets.download;
        networkChart.data.datasets[1].data = chartDatasets.upload;
        networkChart.update();
    } else {
        networkChart = new Chart(ctx, {
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

// Function to update device list
function updateDeviceList() {
    fetch('/api/devices')
        .then(response => response.json())
        .then(data => {
            const devicesList = document.getElementById('devices-list');
            devicesList.innerHTML = '';
            const searchTerm = deviceSearch.value.toLowerCase();
            const filteredDevices = data.filter(device => {
                return device.hostname.toLowerCase().includes(searchTerm) ||
                       device.ip.toLowerCase().includes(searchTerm) ||
                       device.mac.toLowerCase().includes(searchTerm);
            });
            filteredDevices.forEach(device => {
                const row = document.createElement('tr');
                // Status column
                const statusCell = document.createElement('td');
                const statusDiv = document.createElement('div');
                statusDiv.className = 'device-status';
                const statusIndicator = document.createElement('span');
                statusIndicator.className = 'status-indicator';
                let statusText = '';
                if (device.blocked) {
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
                hostnameCell.textContent = device.hostname;
                row.appendChild(hostnameCell);
                // IP column
                const ipCell = document.createElement('td');
                ipCell.textContent = device.ip;
                row.appendChild(ipCell);
                // MAC column
                const macCell = document.createElement('td');
                macCell.textContent = device.mac;
                row.appendChild(macCell);
                // Last seen column
                const lastSeenCell = document.createElement('td');
                lastSeenCell.textContent = device.last_seen;
                row.appendChild(lastSeenCell);
                // Actions column
                const actionsCell = document.createElement('td');
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'device-actions';
                // Block/Unblock Button
                const blockBtn = document.createElement('button');
                blockBtn.className = 'action-btn';
                if (device.blocked) {
                    blockBtn.classList.add('btn-unblock');
                    blockBtn.innerHTML = '<i class="fas fa-unlock"></i> Unblock';
                    blockBtn.addEventListener('click', () => showConfirmModal('unblock', device));
                } else {
                    blockBtn.classList.add('btn-block');
                    blockBtn.innerHTML = '<i class="fas fa-ban"></i> Block';
                    blockBtn.addEventListener('click', () => showConfirmModal('block', device));
                }
                // Kick Button
                const kickBtn = document.createElement('button');
                kickBtn.className = 'action-btn btn-kick';
                kickBtn.innerHTML = '<i class="fas fa-power-off"></i> Kick';
                // Panggil endpoint kick-device
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
        })
        .catch(error => {
            console.error('Error fetching devices:', error);
            showToast('Error fetching device list', 'error');
        });
}

// Function to show confirmation modal
function showConfirmModal(action, device) {
    let title, message;
    modalConfirm.className = 'confirm-btn';
    if (action === 'block') {
        title = 'Block Device';
        message = `Are you sure you want to block ${device.hostname} (${device.ip})?`;
    } else if (action === 'unblock') {
        title = 'Unblock Device';
        message = `Are you sure you want to unblock ${device.hostname} (${device.ip})?`;
        modalConfirm.classList.add('unblock');
    } else if (action === 'kick') {
        title = 'Kick Device';
        message = `Are you sure you want to temporarily disconnect ${device.hostname} (${device.ip})?`;
        modalConfirm.classList.add('kick');
    }
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    confirmModal.style.display = 'block';
    // Remove previous event listeners on modalConfirm
    const clone = modalConfirm.cloneNode(true);
    modalConfirm.parentNode.replaceChild(clone, modalConfirm);
    modalConfirm = clone;
    // Add new event listener with enhanced error handling
    modalConfirm.addEventListener('click', () => {
        confirmModal.style.display = 'none';
        let endpoint, identifier, payload;
        if (action === 'block') {
            endpoint = '/api/block-device';
            identifier = device.ip;
            payload = { identifier };
        } else if (action === 'unblock') {
            endpoint = '/api/unblock-device';
            identifier = device.ip;
            payload = { identifier };
        } else if (action === 'kick') {
            endpoint = '/api/kick-device';
            identifier = device.ip;
            payload = { identifier };
        }
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => { throw new Error('Error ' + response.status + ': ' + text); });
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                showToast(data.message, 'success');
                updateDeviceList();
                updateDashboardStats();
            } else {
                showToast(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            if (error.message.toLowerCase().includes("not found")) {
                updateDeviceList();
                showToast("Device not found. The device list has been updated.", "warning");
            } else {
                showToast('Failed to perform action: ' + error.message, 'error');
            }
        });
    });
}

// Function to show rename modal
function showRenameModal(device) {
    renameModal.style.display = 'block';
    newHostnameInput.value = device.hostname;
    if (renameConfirm) {
        const clone = renameConfirm.cloneNode(true);
        renameConfirm.parentNode.replaceChild(clone, renameConfirm);
        renameConfirm = clone;
    }
    renameConfirm.addEventListener('click', () => {
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
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ip, newHostname })
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => { throw new Error('Error ' + response.status + ': ' + text); });
        }
        return response.json();
    })
    .then(data => {
        if (data.status === 'success') {
            showToast(data.message, 'success');
            updateDeviceList();
        } else {
            showToast(data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error renaming device:', error);
        showToast('Failed to rename device: ' + error.message, 'error');
    });
}

// Function to handle mass rename from JSON file with IP check
function renameDevicesMass(jsonData) {
    if (!Array.isArray(jsonData)) {
        if (typeof jsonData === 'object' && jsonData !== null) {
            jsonData = [jsonData];
        } else {
            showToast('Invalid JSON format: expected an array or a single object with { ip, hostname }', 'error');
            return;
        }
    }
    fetch('/api/devices')
        .then(response => response.json())
        .then(devices => {
            let matchedData = [];
            let unmatchedIPs = [];
            jsonData.forEach(item => {
                if (!item.ip || !item.hostname) return;
                let match = devices.find(device => device.ip === item.ip);
                if (match) {
                    matchedData.push({ ip: item.ip, newHostname: item.hostname });
                } else {
                    unmatchedIPs.push(item.ip);
                }
            });
            if (matchedData.length > 0) {
                fetch('/api/rename-devices-mass', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(matchedData)
                })
                .then(response => {
                    if (!response.ok) {
                        return response.text().then(text => { throw new Error('Error ' + response.status + ': ' + text); });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.status === 'success') {
                        showToast(data.message, 'success');
                        updateDeviceList();
                    } else {
                        showToast(data.message, 'error');
                    }
                })
                .catch(error => {
                    console.error('Error renaming devices:', error);
                    showToast('Failed to rename devices: ' + error.message, 'error');
                });
            } else {
                showToast('No matching devices found for the provided JSON data', 'warning');
            }
            if (unmatchedIPs.length > 0) {
                showToast('The following IP(s) were not found: ' + unmatchedIPs.join(', '), 'warning');
            }
        })
        .catch(error => {
            console.error('Error fetching devices:', error);
            showToast('Error fetching devices for validation', 'error');
        });
}

// Function to close the confirmation modal
function closeConfirmModal() {
    confirmModal.style.display = 'none';
}

// Function to close the rename modal
function closeRenameModal() {
    renameModal.style.display = 'none';
}

// Function to show a toast notification
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
        case 'success':
            icon = 'fas fa-check-circle';
            break;
        case 'error':
            icon = 'fas fa-exclamation-circle';
            break;
        case 'warning':
            icon = 'fas fa-exclamation-triangle';
            break;
        default:
            icon = 'fas fa-info-circle';
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

// Function to update all dashboard data
function refreshDashboard() {
    refreshBtn.classList.add('loading');
    fetch('/api/scan')
        .then(response => response.json())
        .then(data => {
            updateDashboardStats();
            updateTrafficChart();
            setTimeout(() => {
                refreshBtn.classList.remove('loading');
                showToast('Dashboard refreshed', 'success');
            }, 1000);
        })
        .catch(error => {
            console.error('Error initiating scan:', error);
            refreshBtn.classList.remove('loading');
            showToast('Failed to refresh dashboard', 'error');
        });
}

// Function to refresh device list
function refreshDeviceList() {
    refreshDevicesBtn.classList.add('loading');
    fetch('/api/scan')
        .then(response => response.json())
        .then(data => {
            updateDeviceList();
            setTimeout(() => {
                refreshDevicesBtn.classList.remove('loading');
                showToast('Device list refreshed', 'success');
            }, 1000);
        })
        .catch(error => {
            console.error('Error initiating scan:', error);
            refreshDevicesBtn.classList.remove('loading');
            showToast('Failed to refresh device list', 'error');
        });
}

// Function to save settings
function saveSettings() {
    const newInterval = parseInt(scanInterval.value);
    if (isNaN(newInterval) || newInterval < 30) {
        showToast('Scan interval must be at least 30 seconds', 'warning');
        return;
    }
    fetch('/api/update-settings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ scan_interval: newInterval })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast('Settings saved successfully', 'success');
        } else {
            showToast(data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error saving settings:', error);
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
        document.getElementById(targetId).classList.add('active-section');
        if (targetId === 'devices') {
            updateDeviceList();
        }
    });
});

// Event listeners
refreshBtn.addEventListener('click', refreshDashboard);
refreshDevicesBtn.addEventListener('click', refreshDeviceList);
saveSettingsBtn.addEventListener('click', saveSettings);
deviceSearch.addEventListener('input', updateDeviceList);
modalCancel.addEventListener('click', closeConfirmModal);
closeModal.addEventListener('click', closeConfirmModal);
renameCancel.addEventListener('click', closeRenameModal);
document.querySelector('.close-modal').addEventListener('click', closeRenameModal);

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
        closeConfirmModal();
    }
    if (e.target === renameModal) {
        closeRenameModal();
    }
});

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    updateDashboardStats();
    updateTrafficChart();
    setInterval(() => {
        updateDashboardStats();
        updateTrafficChart();
    }, 10000);
});

// Handle mass rename from JSON file
document.getElementById('rename-mass-btn').addEventListener('click', () => {
    const fileInput = document.getElementById('rename-mass-upload');
    const file = fileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            let jsonData = JSON.parse(e.target.result);
            renameDevicesMass(jsonData);
        };
        reader.readAsText(file);
    } else {
        showToast('Please select a JSON file', 'error');
    }
});
