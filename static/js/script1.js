// DOM Elements
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('nav ul li a');
const refreshBtn = document.getElementById('refresh-btn');
const refreshDevicesBtn = document.getElementById('refresh-devices-btn');
const lastUpdateTime = document.getElementById('last-update-time');
const devicesList = document.getElementById('devices-list');
const deviceSearch = document.getElementById('device-search');
const saveSettingsBtn = document.getElementById('save-settings');
const scanIntervalInput = document.getElementById('scan-interval');

// Network statistics elements
const networkStatus = document.getElementById('network-status');
const activeDevices = document.getElementById('active-devices');
const downloadStats = document.getElementById('download-stats');
const uploadStats = document.getElementById('upload-stats');
const localIp = document.getElementById('local-ip');
const gatewayIp = document.getElementById('gateway-ip');
const interfaceEl = document.getElementById('interface');

// Chart
let networkChart;
let prevBytesRecv = 0;
let prevBytesSent = 0;
const chartData = {
    labels: Array(20).fill(''),
    datasets: [
        {
            label: 'Download (KB/s)',
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            data: Array(20).fill(0),
            tension: 0.4,
            fill: true
        },
        {
            label: 'Upload (KB/s)',
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            data: Array(20).fill(0),
            tension: 0.4,
            fill: true
        }
    ]
};

// Global variables
let scanInterval = 60000; // Default 60 seconds
let devices = [];
let autoRefreshTimer;

// Initialize the application
function initApp() {
    setupEventListeners();
    setupNetworkChart();
    fetchNetworkStats();
    fetchDevices();
    
    // Start auto-refresh
    startAutoRefresh();
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            
            // Hide all sections
            sections.forEach(section => {
                section.classList.remove('active-section');
            });
            
            // Show target section
            document.getElementById(targetId).classList.add('active-section');
            
            // Update active nav item
            document.querySelectorAll('nav ul li').forEach(li => {
                li.classList.remove('active');
            });
            link.parentElement.classList.add('active');
        });
    });
    
    // Refresh buttons
    refreshBtn.addEventListener('click', () => {
        refreshData();
    });
    
    refreshDevicesBtn.addEventListener('click', () => {
        fetchDevices();
    });
    
    // Device search
    deviceSearch.addEventListener('input', () => {
        filterDevices();
    });
    
    // Save settings
    saveSettingsBtn.addEventListener('click', () => {
        saveSettings();
    });
}

// Setup network traffic chart
function setupNetworkChart() {
    const ctx = document.getElementById('network-chart').getContext('2d');
    
    networkChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Speed (KB/s)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            animation: {
                duration: 500
            }
        }
    });
}

// Fetch network statistics
function fetchNetworkStats() {
    fetch('/api/stats')
        .then(response => response.json())
        .then(data => {
            updateNetworkStats(data);
            updateNetworkChart(data);
            updateLastScanTime(data.timestamp);
        })
        .catch(error => {
            console.error('Error fetching network stats:', error);
        });
}

// Fetch connected devices
function fetchDevices() {
    fetch('/api/devices')
        .then(response => response.json())
        .then(data => {
            devices = data;
            updateDevicesList();
        })
        .catch(error => {
            console.error('Error fetching devices:', error);
        });
}

// Update network statistics
function updateNetworkStats(data) {
    networkStatus.textContent = 'Online';
    activeDevices.textContent = data.active_devices + ' / ' + data.total_devices;
    localIp.textContent = data.local_ip || '--';
    gatewayIp.textContent = data.gateway_ip || '--';
    interfaceEl.textContent = data.interface || '--';
    
    // Calculate speed since last update
    if (prevBytesRecv > 0 && prevBytesSent > 0) {
        const bytesRecvDiff = data.bytes_recv - prevBytesRecv;
        const bytesSentDiff = data.bytes_sent - prevBytesSent;
        
        // Convert to KB/s (assuming refresh interval is in ms)
        const downloadSpeed = (bytesRecvDiff / 1024) / (scanInterval / 1000);
        const uploadSpeed = (bytesSentDiff / 1024) / (scanInterval / 1000);
        
        downloadStats.textContent = downloadSpeed.toFixed(2) + ' KB/s';
        uploadStats.textContent = uploadSpeed.toFixed(2) + ' KB/s';
    } else {
        downloadStats.textContent = '0.00 KB/s';
        uploadStats.textContent = '0.00 KB/s';
    }
    
    // Update prev values for next calculation
    prevBytesRecv = data.bytes_recv;
    prevBytesSent = data.bytes_sent;
}

// Update network chart
function updateNetworkChart(data) {
    if (prevBytesRecv > 0 && prevBytesSent > 0) {
        const bytesRecvDiff = data.bytes_recv - prevBytesRecv;
        const bytesSentDiff = data.bytes_sent - prevBytesSent;
        
        // Convert to KB/s
        const downloadSpeed = (bytesRecvDiff / 1024) / (scanInterval / 1000);
        const uploadSpeed = (bytesSentDiff / 1024) / (scanInterval / 1000);
        
        // Update chart data
        chartData.datasets[0].data.shift();
        chartData.datasets[0].data.push(downloadSpeed);
        
        chartData.datasets[1].data.shift();
        chartData.datasets[1].data.push(uploadSpeed);
        
        // Update labels (timestamp)
        chartData.labels.shift();
        const now = new Date();
        const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                           now.getMinutes().toString().padStart(2, '0') + ':' + 
                           now.getSeconds().toString().padStart(2, '0');
        chartData.labels.push(timeString);
        
        // Update chart
        networkChart.update();
    }
}

// Update last scan time
function updateLastScanTime(timestamp) {
    if (timestamp) {
        lastUpdateTime.textContent = timestamp;
    } else {
        const now = new Date();
        lastUpdateTime.textContent = now.toLocaleString();
    }
}

// Update devices list
function updateDevicesList() {
    devicesList.innerHTML = '';
    
    if (devices.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="5" class="text-center">No devices found</td>';
        devicesList.appendChild(emptyRow);
        return;
    }
    
    const searchTerm = deviceSearch.value.toLowerCase();
    
    devices.forEach(device => {
        // Filter by search term if provided
        if (searchTerm) {
            const deviceName = (device.hostname || 'Unknown').toLowerCase();
            const deviceIp = device.ip.toLowerCase();
            const deviceMac = (device.mac || 'Unknown').toLowerCase();
            
            if (!deviceName.includes(searchTerm) && 
                !deviceIp.includes(searchTerm) && 
                !deviceMac.includes(searchTerm)) {
                return;
            }
        }
        
        const row = document.createElement('tr');
        
        // Status column
        const statusClass = device.status === 'up' ? 'status-online' : 'status-offline';
        const statusText = device.status === 'up' ? 'Online' : 'Offline';
        
        row.innerHTML = `
            <td><span class="device-status ${statusClass}"></span>${statusText}</td>
            <td>${device.hostname || 'Unknown'}</td>
            <td>${device.ip}</td>
            <td>${device.mac || 'Unknown'}</td>
            <td>${device.last_seen}</td>
        `;
        
        devicesList.appendChild(row);
    });
}

// Filter devices based on search term
function filterDevices() {
    updateDevicesList();
}

// Refresh all data
function refreshData() {
    // Show loading state on buttons
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
    refreshBtn.disabled = true;
    
    // Trigger scan on the server
    fetch('/api/scan')
        .then(response => response.json())
        .then(data => {
            // Wait for scan to complete (1.5 seconds)
            setTimeout(() => {
                fetchNetworkStats();
                fetchDevices();
                
                // Reset button state
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                refreshBtn.disabled = false;
            }, 1500);
        })
        .catch(error => {
            console.error('Error triggering scan:', error);
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            refreshBtn.disabled = false;
        });
}

// Save settings
function saveSettings() {
    const newInterval = parseInt(scanIntervalInput.value);
    
    if (newInterval && newInterval >= 30) {
        scanInterval = newInterval * 1000; // Convert to milliseconds
        
        // Restart auto-refresh with new interval
        startAutoRefresh();
        
        // Show success message
        saveSettingsBtn.textContent = 'Saved!';
        setTimeout(() => {
            saveSettingsBtn.textContent = 'Save Settings';
        }, 2000);
    } else {
        alert('Please enter a valid interval (minimum 30 seconds)');
    }
}

// Start auto refresh timer
function startAutoRefresh() {
    // Clear existing timer if any
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
    
    // Start new timer
    autoRefreshTimer = setInterval(() => {
        fetchNetworkStats();
        fetchDevices();
    }, scanInterval);
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
