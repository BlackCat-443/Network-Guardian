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
const modalConfirm = document.getElementById('modal-confirm');
const modalCancel = document.getElementById('modal-cancel');
const closeModal = document.querySelector('.close-modal');

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
            // Format timestamps for display
            const formattedLabels = data.timestamps.map(timestamp => {
                const date = new Date(timestamp);
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            });
            
            // Calculate data rates for display
            const downloadRates = [];
            const uploadRates = [];
            
            for (let i = 1; i < data.download.length; i++) {
                // Calculate time difference in seconds
                const prevTime = new Date(data.timestamps[i-1]);
                const currTime = new Date(data.timestamps[i]);
                const timeDiff = (currTime - prevTime) / 1000;
                
                // Calculate rates in bytes per second
                const downloadRate = (data.download[i] - data.download[i-1]) / timeDiff;
                const uploadRate = (data.upload[i] - data.upload[i-1]) / timeDiff;
                
                downloadRates.push(downloadRate / 1024); // Convert to KB/s for better visualization
                uploadRates.push(uploadRate / 1024);
            }
            
            // Add a placeholder for the first point since we can't calculate a rate
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
                        position: 'top',
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
                kickBtn.addEventListener('click', () => showConfirmModal('kick', device));
                
                actionsDiv.appendChild(blockBtn);
                actionsDiv.appendChild(kickBtn);
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
    
    // Remove previous event listeners
    const clone = modalConfirm.cloneNode(true);
    modalConfirm.parentNode.replaceChild(clone, modalConfirm);
    modalConfirm = clone;
    
    // Add new event listener
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
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })
        .then(response => response.json())
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
            showToast('Failed to perform action', 'error');
        });
    });
}

// Function to close the modal
function closeConfirmModal() {
    confirmModal.style.display = 'none';
}

// Function to show a toast notification
function showToast(message, type = 'info') {
    // Check if toast container exists, if not create it
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Set icon based on type
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
    
    // Create toast content
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon"><i class="${icon}"></i></span>
            <span>${message}</span>
        </div>
        <span class="toast-close"><i class="fas fa-times"></i></span>
    `;
    
    // Add toast to container
    toastContainer.appendChild(toast);
    
    // Add click event to close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
    
    // Auto remove toast after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Function to update all dashboard data
function refreshDashboard() {
    refreshBtn.classList.add('loading');
    
    // Trigger a new scan
    fetch('/api/scan')
        .then(response => response.json())
        .then(data => {
            updateDashboardStats();
            updateTrafficChart();
            
            // Remove loading class after a short delay
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
    
    // Trigger a new scan
    fetch('/api/scan')
        .then(response => response.json())
        .then(data => {
            updateDeviceList();
            
            // Remove loading class after a short delay
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
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scan_interval: newInterval }),
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
        
        // Remove active class from all links and sections
        navLinks.forEach(navLink => {
            navLink.parentElement.classList.remove('active');
        });
        document.querySelectorAll('section').forEach(section => {
            section.classList.remove('active-section');
        });
        
        // Add active class to clicked link and corresponding section
        link.parentElement.classList.add('active');
        const targetId = link.getAttribute('href').substring(1);
        document.getElementById(targetId).classList.add('active-section');
        
        // If navigating to devices tab, update device list
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

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
        closeConfirmModal();
    }
});

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Initial data load
    updateDashboardStats();
    updateTrafficChart();
    
    // Set up periodic refresh (every 10 seconds for dashboard)
    setInterval(() => {
        updateDashboardStats();
        updateTrafficChart();
    }, 10000);
});


// 






// Add buttons to toggle between different time ranges
const timeRangeButtons = document.createElement('div');
timeRangeButtons.className = 'time-range-buttons';
timeRangeButtons.innerHTML = `
    <button class="time-btn active" data-range="1h">1h</button>
    <button class="time-btn" data-range="6h">6h</button>
    <button class="time-btn" data-range="24h">24h</button>
    <button class="time-btn" data-range="7d">7d</button>
`;

// Insert before the chart
document.querySelector('.chart-card').insertBefore(timeRangeButtons, document.getElementById('network-chart'));

// Add event listeners
document.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Remove active class from all buttons
        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        e.target.classList.add('active');
        
        // Get selected time range
        const range = e.target.dataset.range;
        
        // Update chart data based on time range
        fetchChartData(range);
    });
});

// Function to fetch chart data based on time range
function fetchChartData(range) {
    fetch(`/api/traffic-history?range=${range}`)
        .then(response => response.json())
        .then(data => {
            // Update chart with new data
            updateChartWithData(data);
        })
        .catch(error => {
            console.error('Error fetching traffic history:', error);
            showToast('Error fetching chart data', 'error');
        });
}

// Function to update chart with new data
function updateChartWithData(data) {
    // Format the data as needed for the chart
    const formattedLabels = data.timestamps.map(timestamp => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    
    // Calculate rates as before
    // ... existing rate calculation code ...
    
    // Update chart
    networkChart.data.labels = formattedLabels;
    networkChart.data.datasets[0].data = downloadRates;
    networkChart.data.datasets[1].data = uploadRates;
    networkChart.update();
}





// Add export buttons
const exportButtons = document.createElement('div');
exportButtons.className = 'export-buttons';
exportButtons.innerHTML = `
    <button id="export-csv" class="export-btn"><i class="fas fa-file-csv"></i> Export CSV</button>
    <button id="export-png" class="export-btn"><i class="fas fa-file-image"></i> Export PNG</button>
`;

// Insert after the chart
document.querySelector('.chart-card').appendChild(exportButtons);

// Add event listeners
document.getElementById('export-csv').addEventListener('click', exportCSV);
document.getElementById('export-png').addEventListener('click', exportPNG);


function exportCSV() {
    Promise.all([
        fetch('/api/traffic-history').then(r => r.json()),
        fetch('/api/devices').then(r => r.json()),
        fetch('/api/stats').then(r => r.json()),
        fetch('/api/system-info').then(r => r.json())
    ]).then(([traffic, devices, stats, system]) => {
        // Formatting Function
        function formatDataSize(bytes) {
            const units = ['B', 'KB', 'MB', 'GB', 'TB'];
            let size = bytes;
            let unitIndex = 0;

            while (size >= 1024 && unitIndex < units.length - 1) {
                size /= 1024;
                unitIndex++;
            }

            return `${size.toFixed(2)} ${units[unitIndex]}`;
        }

        // Membuat array untuk CSV
        const csvRows = [
            "Network Monitoring Data Export",
            `Exported At: ${new Date().toISOString()}`,
            `Hostname: ${system.hostname}`,
            `IP Address: ${stats.local_ip}`,
            "", // Baris kosong

            "Traffic History",
            "Timestamp,Download,Upload,Download Rate,Upload Rate"
        ];

        // Tambahkan data traffic history
        for(let i = 0; i < traffic.timestamps.length; i++) {
            const timestamp = new Date(traffic.timestamps[i]).toLocaleString();
            const downloadSize = formatDataSize(traffic.download[i]);
            const uploadSize = formatDataSize(traffic.upload[i]);
            const dlRate = i > 0 ? 
                ((traffic.download[i] - traffic.download[i-1])/1024).toFixed(2) + " KB/s" : 
                "0 KB/s";
            const ulRate = i > 0 ? 
                ((traffic.upload[i] - traffic.upload[i-1])/1024).toFixed(2) + " KB/s" : 
                "0 KB/s";
            
            csvRows.push(`${timestamp},${downloadSize},${uploadSize},${dlRate},${ulRate}`);
        }

        // Tambahkan header devices
        csvRows.push("", "Connected Devices");
        csvRows.push("IP Address,Hostname,MAC Address,Status,Blocked,First Seen,Last Seen");

        // Tambahkan data devices
        devices.forEach(device => {
            csvRows.push(`${device.ip},${device.hostname},${device.mac},${device.status},${device.blocked ? 'Yes' : 'No'},${new Date(device.first_seen).toLocaleString()},${new Date(device.last_seen).toLocaleString()}`);
        });

        // Tambahkan statistik jaringan
        csvRows.push("", "Network Statistics");
        csvRows.push(`Total Upload: ${formatDataSize(stats.bytes_sent)}`);
        csvRows.push(`Total Download: ${formatDataSize(stats.bytes_recv)}`);
        csvRows.push(`Active Devices: ${stats.active_devices}`);
        csvRows.push(`Blocked Devices: ${stats.blocked_devices}`);

        // Konversi array ke string CSV
        const csvContent = csvRows.join('\n');

        // Fungsi download manual
        function manualDownload(content, fileName) {
            // Coba metode pertama: window.open
            try {
                const blob = new Blob([content], {type: 'text/csv;charset=utf-8;'});
                const url = window.URL.createObjectURL(blob);
                window.open(url);
                return true;
            } catch (openError) {
                console.error('Window open method failed:', openError);
            }

            // Metode kedua: window.location
            try {
                const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(content);
                window.location.href = encodedUri;
                return true;
            } catch (locationError) {
                console.error('Location href method failed:', locationError);
            }

            // Metode terakhir: prompt download
            try {
                const downloadLink = document.createElement('a');
                downloadLink.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(content);
                downloadLink.download = fileName;
                
                // Munculkan konfirmasi download manual
                alert('Tidak dapat download otomatis. Silakan klik OK dan gunakan "Simpan" di jendela baru.');
                window.open(downloadLink.href, '_blank');
                return true;
            } catch (finalError) {
                console.error('Final download method failed:', finalError);
                alert('Gagal melakukan download. Mohon periksa pengaturan browser Anda.');
                return false;
            }
        }

        // Eksekusi download
        manualDownload(csvContent, `network_data_${new Date().getTime()}.csv`);

        // Logging
        console.log('CSV Export Completed');
        console.log(`Exported ${traffic.timestamps.length} traffic records`);
        console.log(`Exported ${devices.length} devices`);
    }).catch(error => {
        console.error('Export error:', error);
        alert('Gagal mengekspor data: ' + error.message);
    });
}

// Tambahkan event listener (opsional)
document.addEventListener('DOMContentLoaded', () => {
    const exportButton = document.getElementById('export-csv-btn');
    if (exportButton) {
        exportButton.addEventListener('click', exportCSV);
    }
});


function exportPNG() {
    const formatBytes = (bytes) => {
        if (typeof bytes !== 'number' || isNaN(bytes)) return '0 B';
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, unitIndex)).toFixed(2)} ${units[unitIndex]}`;
    };

    Promise.all([
        fetch('/api/hostname'),
        fetch('/api/traffic-history'),
        fetch('/api/devices'),
        fetch('/api/stats'),
        fetch('/api/system-info')
    ])
    .then(async ([hostnameRes, trafficRes, devicesRes, statsRes, systemRes]) => {
        const data = {
            hostname: await hostnameRes.json(),
            traffic: await trafficRes.json(),
            devices: await devicesRes.json(),
            stats: await statsRes.json(),
            system: await systemRes.json(),
            exportTime: new Date().toLocaleString()
        };

        // 1. Dapatkan base64 image dari chart asli
        const chartBase64 = networkChart.toBase64Image('png', 1);
        
        // 2. Buat container khusus untuk ekspor
        const exportContainer = document.createElement('div');
        exportContainer.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: 1200px;
            background: white;
            padding: 30px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            opacity: 0;
            pointer-events: none;
        `;

        // 3. Bangun HTML dengan error handling
        const deviceRows = data.devices.map(device => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${device.ip || 'N/A'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${device.hostname || 'Unknown'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${device.mac || 'N/A'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6; color: ${device.status === 'up' ? '#27ae60' : '#e74c3c'}">
                    ${(device.status || 'down').toUpperCase()}
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">
                    ▲ ${formatBytes(device.upload || 0)} / ▼ ${formatBytes(device.download || 0)}
                </td>
            </tr>
        `).join('');

        exportContainer.innerHTML = `
            <div style="margin-bottom: 30px;">
                <h1 style="color: #2c3e50; margin: 0 0 5px;">Laporan Jaringan</h1>
                <p style="color: #7f8c8d; margin: 0;">Diekspor pada: ${data.exportTime}</p>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
                <!-- System Info -->
                <div>
                    <h3 style="color: #3498db; margin: 0 0 10px;">Sistem</h3>
                    <p>Hostname: ${data.system.hostname || 'N/A'}</p>
                    <p>IP: ${data.stats.local_ip || 'N/A'}</p>
                    <p>Platform: ${data.system.platform || 'N/A'}</p>
                    <p>Uptime: ${Math.floor((data.system.uptime || 0)/3600)} jam</p>
                </div>
                
                <!-- Traffic Info -->
                <div>
                    <h3 style="color: #3498db; margin: 0 0 10px;">Traffic</h3>
                    <p>Total Upload: ${formatBytes(data.stats.bytes_sent || 0)}</p>
                    <p>Total Download: ${formatBytes(data.stats.bytes_recv || 0)}</p>
                    <p>Interface: ${data.stats.interface || 'N/A'}</p>
                </div>
                
                <!-- Device Summary -->
                <div>
                    <h3 style="color: #3498db; margin: 0 0 10px;">Perangkat</h3>
                    <p>Total: ${data.devices.length || 0}</p>
                    <p>Online: ${data.devices.filter(d => d.status === 'up').length || 0}</p>
                    <p>Diblokir: ${data.devices.filter(d => d.blocked).length || 0}</p>
                </div>
            </div>
            
            <!-- Chart Image -->
            <img src="${chartBase64}" style="width: 100%; height: auto; margin-bottom: 20px;" alt="Network Chart">
            
            <!-- Device Details -->
            <div style="margin-bottom: 30px;">
                <h3 style="color: #3498db; margin: 0 0 15px;">Detail Perangkat</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">IP</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Hostname</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">MAC</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Status</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Penggunaan Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${deviceRows}
                    </tbody>
                </table>
            </div>
        `;

        document.body.appendChild(exportContainer);

        try {
            await html2canvas(exportContainer, {
                scale: 2,
                useCORS: true,
                logging: true,
                windowWidth: exportContainer.scrollWidth,
                windowHeight: exportContainer.scrollHeight
            }).then(canvas => {
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = `network_report_${Date.now()}.png`;
                link.click();
            });
            
            showToast('Laporan berhasil di-export', 'success');
        } catch (error) {
            console.error('Export Error:', error);
            showToast('Gagal mengekspor laporan', 'error');
        } finally {
            exportContainer.remove();
        }
    })
    .catch(error => {
        console.error('Fetch Error:', error);
        showToast('Gagal mengambil data', 'error');
    });
}


// Add real-time toggle
const realtimeToggle = document.createElement('div');
realtimeToggle.className = 'realtime-toggle';
realtimeToggle.innerHTML = `
    <label for="realtime-checkbox">
        <input type="checkbox" id="realtime-checkbox" checked>
        Real-time updates
    </label>
`;

// Insert before the chart
document.querySelector('.chart-card').insertBefore(realtimeToggle, document.getElementById('network-chart'));

// Add event listener
let realtimeInterval;
document.getElementById('realtime-checkbox').addEventListener('change', (e) => {
    if (e.target.checked) {
        // Enable real-time updates
        realtimeInterval = setInterval(() => {
            updateTrafficChart();
        }, 5000); // Update every 5 seconds
        showToast('Real-time updates enabled', 'info');
    } else {
        // Disable real-time updates
        clearInterval(realtimeInterval);
        showToast('Real-time updates disabled', 'info');
    }
});
