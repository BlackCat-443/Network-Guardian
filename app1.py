from flask import Flask, render_template, jsonify
import nmap
import psutil
import socket
import netifaces
import time
import threading
import json
import os
from datetime import datetime

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# Global variables to store data
devices = []
network_stats = {}
scan_interval = 60  # seconds
last_scan_time = None

# Get local machine IP and network details
def get_local_network_info():
    network_info = {}
    try:
        # Get default gateway interface
        gateways = netifaces.gateways()
        default_gateway = gateways['default'][netifaces.AF_INET]
        gateway_ip = default_gateway[0]
        interface = default_gateway[1]
        
        # Get interface details
        interface_details = netifaces.ifaddresses(interface)
        ip_info = interface_details[netifaces.AF_INET][0]
        local_ip = ip_info['addr']
        netmask = ip_info['netmask']
        
        # Calculate network CIDR
        netmask_bits = sum([bin(int(x)).count('1') for x in netmask.split('.')])
        cidr = f"{local_ip.rsplit('.', 1)[0]}.0/{netmask_bits}"
        
        network_info = {
            'local_ip': local_ip,
            'gateway_ip': gateway_ip,
            'interface': interface,
            'netmask': netmask,
            'cidr': cidr
        }
    except Exception as e:
        print(f"Error getting network info: {e}")
        # Fallback to simple method
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        network_info = {
            'local_ip': local_ip,
            'gateway_ip': 'Unknown',
            'interface': 'Unknown',
            'netmask': 'Unknown',
            'cidr': f"{local_ip.rsplit('.', 1)[0]}.0/24"  # Assume /24 network
        }
    
    return network_info

# Scan network for devices
def scan_network():
    global devices, last_scan_time
    
    network_info = get_local_network_info()
    cidr = network_info['cidr']
    
    nm = nmap.PortScanner()
    print(f"Scanning network {cidr}...")
    
    try:
        nm.scan(hosts=cidr, arguments='-sn')  # Ping scan
        
        discovered_devices = []
        for host in nm.all_hosts():
            device_info = {
                'ip': host,
                'hostname': nm[host].hostname() if 'hostname' in nm[host] else 'Unknown',
                'status': nm[host]['status']['state'],
                'last_seen': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'first_seen': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'mac': 'Unknown',
                'vendor': 'Unknown'
            }
            
            # Try to get MAC address from ARP table
            try:
                if os.name == 'posix':  # Linux/Mac
                    import subprocess
                    cmd = f"arp -n {host} | grep -v Address | awk '{{print $3}}'"
                    mac = subprocess.check_output(cmd, shell=True).decode().strip()
                    if mac and mac != '(incomplete)':
                        device_info['mac'] = mac
                elif os.name == 'nt':  # Windows
                    import subprocess
                    cmd = f"arp -a {host}"
                    result = subprocess.check_output(cmd, shell=True).decode()
                    for line in result.splitlines():
                        if host in line:
                            parts = line.split()
                            if len(parts) >= 2:
                                mac = parts[1].replace('-', ':')
                                device_info['mac'] = mac
            except:
                pass
            
            discovered_devices.append(device_info)
        
        # Update existing devices with new information
        for new_device in discovered_devices:
            found = False
            for existing_device in devices:
                if existing_device['ip'] == new_device['ip']:
                    existing_device['status'] = new_device['status']
                    existing_device['last_seen'] = new_device['last_seen']
                    if new_device['hostname'] != 'Unknown':
                        existing_device['hostname'] = new_device['hostname']
                    if new_device['mac'] != 'Unknown':
                        existing_device['mac'] = new_device['mac']
                    found = True
                    break
            
            if not found:
                devices.append(new_device)
        
        # Mark devices not seen in this scan as offline
        for device in devices:
            if device['ip'] not in [d['ip'] for d in discovered_devices]:
                device['status'] = 'down'
        
        last_scan_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
    except Exception as e:
        print(f"Error scanning network: {e}")

# Get network statistics
def get_network_stats():
    global network_stats
    
    try:
        net_io = psutil.net_io_counters()
        
        # Get network info
        network_info = get_local_network_info()
        
        stats = {
            'bytes_sent': net_io.bytes_sent,
            'bytes_recv': net_io.bytes_recv,
            'packets_sent': net_io.packets_sent,
            'packets_recv': net_io.packets_recv,
            'local_ip': network_info['local_ip'],
            'gateway_ip': network_info['gateway_ip'],
            'interface': network_info['interface'],
            'active_devices': sum(1 for device in devices if device['status'] == 'up'),
            'total_devices': len(devices),
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        network_stats = stats
    except Exception as e:
        print(f"Error getting network stats: {e}")

# Background task to periodically scan network and update stats
def background_task():
    while True:
        scan_network()
        get_network_stats()
        time.sleep(scan_interval)

# Function to initialize the background task
def initialize():
    thread = threading.Thread(target=background_task)
    thread.daemon = True
    thread.start()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/devices')
def get_devices():
    return jsonify(devices)

@app.route('/api/stats')
def get_stats():
    return jsonify(network_stats)

@app.route('/api/scan')
def trigger_scan():
    threading.Thread(target=scan_network).start()
    threading.Thread(target=get_network_stats).start()
    return jsonify({"status": "Scan initiated", "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")})

if __name__ == '__main__':
    # Initial scan
    scan_network()
    get_network_stats()
    
    # Start the background task before running the app
    initialize()
    
    # Run Flask app
    app.run(host='0.0.0.0', port=5000, debug=True)