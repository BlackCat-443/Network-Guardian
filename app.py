from flask import Flask, render_template, jsonify, request
import nmap
import psutil
import socket
import netifaces
import time
import threading
import json
import os
import subprocess
from datetime import datetime
import platform

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# Global variables to store data
devices = []
blocked_devices = []  # List to store blocked devices
network_stats = {}
scan_interval = 60  # seconds
last_scan_time = None
traffic_history = {
    'timestamps': [],
    'download': [],
    'upload': []
}

# Get hostname of the local machine
def get_local_hostname():
    try:
        return socket.gethostname()
    except:
        return "Unknown"

# Get local machine IP and network details
def get_local_network_info():
    network_info = {}
    try:
        # Get local hostname first - this is the most important part
        local_hostname = get_local_hostname()
        
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
            'cidr': cidr,
            'hostname': local_hostname
        }
    except Exception as e:
        print(f"Error getting network info: {e}")
        # Fallback to simple method
        hostname = get_local_hostname()
        try:
            local_ip = socket.gethostbyname(hostname)
        except:
            local_ip = "127.0.0.1"
            
        network_info = {
            'local_ip': local_ip,
            'gateway_ip': 'Unknown',
            'interface': 'Unknown',
            'netmask': 'Unknown',
            'cidr': f"{local_ip.rsplit('.', 1)[0]}.0/24",  # Assume /24 network
            'hostname': hostname
        }
    
    # Debug output to console
    print(f"Local Network Info: {network_info}")
    return network_info

# Very simple function to attempt DNS resolution
def simple_hostname_lookup(ip):
    try:
        hostname, _, _ = socket.gethostbyaddr(ip)
        return hostname
    except:
        return None

# Improved function to get hostname
def get_hostname(ip):
    # Add timeout to prevent long lookups
    socket.setdefaulttimeout(1)  # Set 1 second timeout for socket operations
    
    # Try DNS resolution first (simple but effective when it works)
    try:
        hostname, _, _ = socket.gethostbyaddr(ip)
        return hostname
    except:
        # If DNS resolution fails, check if it's the local machine
        my_ip = get_local_network_info()['local_ip']
        if ip == my_ip:
            return get_local_hostname()
        
        # For non-local machines, just return Unknown without additional lookups
        return "Unknown"

# Scan network for devices
def scan_network():
    global devices, last_scan_time
    
    network_info = get_local_network_info()
    cidr = network_info['cidr']
    local_ip = network_info['local_ip']
    local_hostname = network_info['hostname']
    
    print(f"Starting network scan for {cidr}")
    print(f"Local IP: {local_ip}, Local Hostname: {local_hostname}")
    
    nm = nmap.PortScanner()
    
    try:
        # Use more intensive scan to get better device information
        nm.scan(hosts=cidr, arguments='-sn')  # Ping scan
        
        discovered_devices = []
        for host in nm.all_hosts():
            # Try to get hostname with our simplified function
            hostname = get_hostname(host)
            
            # If it's the local machine, use the hostname we already know
            if host == local_ip:
                hostname = local_hostname
                print(f"Local machine detected: {host} with hostname {hostname}")
            
            device_info = {
                'ip': host,
                'hostname': hostname,
                'status': nm[host]['status']['state'],
                'last_seen': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'first_seen': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'mac': 'Unknown',
                'vendor': 'Unknown',
                'blocked': False,
                'is_local': (host == local_ip)  # Mark if this is the local machine
            }
            
            # Print debug for the device
            print(f"Discovered device: {device_info}")
            
            # Try to get MAC address from ARP table
            try:
                if os.name == 'posix':  # Linux/Mac
                    cmd = f"arp -n {host} | grep -v Address | awk '{{print $3}}'"
                    mac = subprocess.check_output(cmd, shell=True).decode().strip()
                    if mac and mac != '(incomplete)':
                        device_info['mac'] = mac
                elif os.name == 'nt':  # Windows
                    cmd = f"arp -a {host}"
                    result = subprocess.check_output(cmd, shell=True).decode()
                    for line in result.splitlines():
                        if host in line:
                            parts = line.split()
                            if len(parts) >= 2:
                                mac = parts[1].replace('-', ':')
                                device_info['mac'] = mac
            except Exception as e:
                print(f"Error getting MAC for {host}: {e}")
            
            # Check if device is in blocked list
            if device_info['ip'] in blocked_devices or device_info['mac'] in blocked_devices:
                device_info['blocked'] = True
            
            discovered_devices.append(device_info)
        
        # Update existing devices with new information
        for new_device in discovered_devices:
            found = False
            for existing_device in devices:
                if existing_device['ip'] == new_device['ip']:
                    existing_device['status'] = new_device['status']
                    existing_device['last_seen'] = new_device['last_seen']
                    
                    # Update hostname if we have a better one
                    if new_device['hostname'] != 'Unknown':
                        existing_device['hostname'] = new_device['hostname']
                    
                    if new_device['mac'] != 'Unknown':
                        existing_device['mac'] = new_device['mac']
                    
                    # Preserve blocked status
                    new_device['blocked'] = existing_device['blocked']
                    
                    # Mark if this is the local machine
                    existing_device['is_local'] = new_device['is_local']
                    
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
    global network_stats, traffic_history
    
    try:
        net_io = psutil.net_io_counters()
        
        # Get network info
        network_info = get_local_network_info()
        
        # Calculate traffic rates (for display purposes)
        if len(traffic_history['timestamps']) > 0:
            last_bytes_sent = traffic_history['upload'][-1]
            last_bytes_recv = traffic_history['download'][-1]
            last_timestamp = traffic_history['timestamps'][-1]
            
            # Calculate time difference in seconds
            time_diff = (datetime.now() - datetime.strptime(last_timestamp, "%Y-%m-%d %H:%M:%S")).total_seconds()
            
            # Calculate rates in bytes per second
            upload_rate = (net_io.bytes_sent - last_bytes_sent) / time_diff if time_diff > 0 else 0
            download_rate = (net_io.bytes_recv - last_bytes_recv) / time_diff if time_diff > 0 else 0
        else:
            upload_rate = 0
            download_rate = 0
        
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Get local hostname again to ensure it's current
        local_hostname = get_local_hostname()
        
        stats = {
            'bytes_sent': net_io.bytes_sent,
            'bytes_recv': net_io.bytes_recv,
            'packets_sent': net_io.packets_sent,
            'packets_recv': net_io.packets_recv,
            'upload_rate': upload_rate,
            'download_rate': download_rate,
            'local_ip': network_info['local_ip'],
            'gateway_ip': network_info['gateway_ip'],
            'interface': network_info['interface'],
            'hostname': local_hostname,  # Ensure we have current hostname
            'active_devices': sum(1 for device in devices if device['status'] == 'up'),
            'blocked_devices': sum(1 for device in devices if device['blocked']),
            'total_devices': len(devices),
            'timestamp': timestamp
        }
        
        # Debug output
        print(f"Network stats updated. Local hostname: {local_hostname}")
        
        network_stats = stats
        
        # Update traffic history (keep last 20 points for the chart)
        traffic_history['timestamps'].append(timestamp)
        traffic_history['download'].append(net_io.bytes_recv)
        traffic_history['upload'].append(net_io.bytes_sent)
        
        # Keep only the last 20 data points
        if len(traffic_history['timestamps']) > 20:
            traffic_history['timestamps'] = traffic_history['timestamps'][-20:]
            traffic_history['download'] = traffic_history['download'][-20:]
            traffic_history['upload'] = traffic_history['upload'][-20:]
            
    except Exception as e:
        print(f"Error getting network stats: {e}")

# Function to block a device - Updated for actual blocking
def block_device(identifier):
    global devices, blocked_devices
    
    for device in devices:
        if device['ip'] == identifier or device['mac'] == identifier:
            # Mark as blocked in our app data
            device['blocked'] = True
            if identifier not in blocked_devices:
                blocked_devices.append(identifier)
            
            try:
                target_ip = device['ip']
                interface = get_local_network_info()['interface']
                
                # Implement actual blocking based on OS
                if os.name == 'posix':  # Linux
                    # Check if iptables is available
                    try:
                        subprocess.run(['which', 'iptables'], check=True, stdout=subprocess.PIPE)
                        
                        # Add rule to block the IP
                        block_cmd = f"sudo iptables -A INPUT -s {target_ip} -j DROP"
                        subprocess.run(block_cmd, shell=True, check=True)
                        
                        # Add rule to block outgoing connections
                        block_out_cmd = f"sudo iptables -A OUTPUT -d {target_ip} -j DROP"
                        subprocess.run(block_out_cmd, shell=True, check=True)
                        
                        print(f"Blocked IP {target_ip} using iptables")
                    except subprocess.CalledProcessError:
                        # If iptables fails, try using arptables for MAC address blocking
                        if device['mac'] != 'Unknown':
                            try:
                                block_mac_cmd = f"sudo arptables -A INPUT --source-mac {device['mac']} -j DROP"
                                subprocess.run(block_mac_cmd, shell=True)
                                print(f"Blocked MAC {device['mac']} using arptables")
                            except Exception as e:
                                print(f"Failed to block using arptables: {e}")
                        else:
                            print("Failed to block: iptables unavailable and MAC unknown")
                
                elif os.name == 'nt':  # Windows
                    # Use Windows Firewall to block the IP
                    rule_name = f"Block_{target_ip.replace('.', '_')}"
                    fw_cmd = f'netsh advfirewall firewall add rule name="{rule_name}" dir=in action=block remoteip={target_ip}'
                    subprocess.run(fw_cmd, shell=True)
                    
                    # Block outgoing connections too
                    fw_out_cmd = f'netsh advfirewall firewall add rule name="{rule_name}_out" dir=out action=block remoteip={target_ip}'
                    subprocess.run(fw_out_cmd, shell=True)
                    
                    print(f"Blocked IP {target_ip} using Windows Firewall")
                
                # Store the blocking method used for later unblocking
                device['blocking_method'] = 'iptables' if os.name == 'posix' else 'windows_firewall'
                
                return True
                
            except Exception as e:
                print(f"Error while blocking device {identifier}: {e}")
                # Still mark as blocked in our app even if system command failed
                return True
    
    return False

# Function to unblock a device - Updated for actual unblocking
def unblock_device(identifier):
    global devices, blocked_devices
    
    for device in devices:
        if device['ip'] == identifier or device['mac'] == identifier:
            # Remove from blocked list
            device['blocked'] = False
            if identifier in blocked_devices:
                blocked_devices.remove(identifier)
            
            try:
                target_ip = device['ip']
                
                # Implement actual unblocking based on OS
                if os.name == 'posix':  # Linux
                    # Try to unblock with iptables
                    try:
                        # Remove the blocking rules
                        unblock_cmd = f"sudo iptables -D INPUT -s {target_ip} -j DROP"
                        subprocess.run(unblock_cmd, shell=True)
                        
                        unblock_out_cmd = f"sudo iptables -D OUTPUT -d {target_ip} -j DROP"
                        subprocess.run(unblock_out_cmd, shell=True)
                        
                        print(f"Unblocked IP {target_ip} using iptables")
                    except Exception as e1:
                        print(f"Error unblocking with iptables: {e1}")
                        
                        # Try arptables if MAC is known
                        if device['mac'] != 'Unknown':
                            try:
                                unblock_mac_cmd = f"sudo arptables -D INPUT --source-mac {device['mac']} -j DROP"
                                subprocess.run(unblock_mac_cmd, shell=True)
                                print(f"Unblocked MAC {device['mac']} using arptables")
                            except Exception as e2:
                                print(f"Error unblocking with arptables: {e2}")
                
                elif os.name == 'nt':  # Windows
                    # Use Windows Firewall to unblock the IP
                    rule_name = f"Block_{target_ip.replace('.', '_')}"
                    fw_cmd = f'netsh advfirewall firewall delete rule name="{rule_name}"'
                    subprocess.run(fw_cmd, shell=True)
                    
                    # Unblock outgoing connections too
                    fw_out_cmd = f'netsh advfirewall firewall delete rule name="{rule_name}_out"'
                    subprocess.run(fw_out_cmd, shell=True)
                    
                    print(f"Unblocked IP {target_ip} using Windows Firewall")
                
                return True
                
            except Exception as e:
                print(f"Error while unblocking device {identifier}: {e}")
                # Still mark as unblocked in our app even if system command failed
                return True
    
    return False

# Function to kick (temporarily disconnect) a device - Updated for actual kicking
def kick_device(identifier):
    for device in devices:
        if device['ip'] == identifier or device['mac'] == identifier:
            # Mark as temporarily disconnected in our app data
            device['status'] = 'down'
            
            try:
                target_ip = device['ip']
                target_mac = device['mac']
                gateway_ip = get_local_network_info()['gateway_ip']
                interface = get_local_network_info()['interface']
                
                # Implement actual kicking using ARP spoofing
                if os.name == 'posix':  # Linux
                    try:
                        # Check if we have arping installed
                        subprocess.run(['which', 'arping'], check=True, stdout=subprocess.PIPE)
                        
                        # Send fake ARP packets to both the target and the gateway
                        # To the target: pretend to be the gateway
                        if target_mac != 'Unknown':
                            spoof_cmd1 = f"sudo arping -c 5 -U -I {interface} -s {gateway_ip} {target_ip}"
                            subprocess.Popen(spoof_cmd1, shell=True)
                            
                            # To the gateway: pretend to be the target
                            spoof_cmd2 = f"sudo arping -c 5 -U -I {interface} -s {target_ip} {gateway_ip}"
                            subprocess.Popen(spoof_cmd2, shell=True)
                            
                            print(f"Sent ARP spoofing packets to kick {target_ip}")
                            
                            # Block the device temporarily
                            block_device(identifier)
                            # Schedule unblocking after 10 seconds
                            threading.Timer(10.0, lambda: unblock_device(identifier)).start()
                            
                            return True
                        else:
                            print(f"Cannot kick: MAC address unknown for {target_ip}")
                            return False
                    except subprocess.CalledProcessError:
                        print("arping not found, cannot perform kick operation")
                        return False
                
                elif os.name == 'nt':  # Windows
                    # On Windows, we'll temporarily block and then unblock after a short time
                    block_device(identifier)
                    # Schedule unblocking after 10 seconds
                    threading.Timer(10.0, lambda: unblock_device(identifier)).start()
                    print(f"Kicked {target_ip} by temporarily blocking")
                    return True
                
            except Exception as e:
                print(f"Error while kicking device {identifier}: {e}")
                return False
    
    return False

# New function to get and display system information
@app.route('/api/system-info')
def get_system_info():
    system_info = {
        'hostname': get_local_hostname(),
        'platform': platform.system(),
        'platform_version': platform.version(),
        'processor': platform.processor(),
        'architecture': platform.machine(),
        'python_version': platform.python_version(),
        'uptime': int(time.time() - psutil.boot_time())
    }
    
    # Memory information
    mem = psutil.virtual_memory()
    system_info['memory_total'] = mem.total
    system_info['memory_available'] = mem.available
    system_info['memory_percent'] = mem.percent
    
    # Disk information
    disk = psutil.disk_usage('/')
    system_info['disk_total'] = disk.total
    system_info['disk_free'] = disk.free
    system_info['disk_percent'] = disk.percent
    
    return jsonify(system_info)

# Background task to periodically scan network and update stats
def background_task():
    while True:
        try:
            scan_network()
            get_network_stats()
        except Exception as e:
            print(f"Error in background task: {e}")
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
def get_devices_api():
    return jsonify(devices)

@app.route('/api/stats')
def get_stats_api():
    # Include hostname directly in the response 
    stats = network_stats.copy()
    stats['hostname'] = get_local_hostname()  # Ensure it's current
    return jsonify(stats)

@app.route('/api/hostname')
def get_hostname_api():
    # Simple endpoint just to get the hostname
    return jsonify({"hostname": get_local_hostname()})

@app.route('/api/traffic-history')
def get_traffic_history():
    return jsonify(traffic_history)

@app.route('/api/scan')
def trigger_scan():
    threading.Thread(target=scan_network).start()
    threading.Thread(target=get_network_stats).start()
    return jsonify({
        "status": "Scan initiated", 
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "hostname": get_local_hostname()  # Include hostname in the response
    })

@app.route('/api/block-device', methods=['POST'])
def block_device_api():
    data = request.get_json()
    identifier = data.get('identifier')
    if not identifier:
        return jsonify({"status": "error", "message": "No identifier provided"}), 400
    
    success = block_device(identifier)
    if success:
        return jsonify({"status": "success", "message": f"Device {identifier} blocked"})
    else:
        return jsonify({"status": "error", "message": f"Device {identifier} not found"}), 404

@app.route('/api/unblock-device', methods=['POST'])
def unblock_device_api():
    data = request.get_json()
    identifier = data.get('identifier')
    if not identifier:
        return jsonify({"status": "error", "message": "No identifier provided"}), 400
    
    success = unblock_device(identifier)
    if success:
        return jsonify({"status": "success", "message": f"Device {identifier} unblocked"})
    else:
        return jsonify({"status": "error", "message": f"Device {identifier} not found"}), 404

@app.route('/api/kick-device', methods=['POST'])
def kick_device_api():
    data = request.get_json()
    identifier = data.get('identifier')
    if not identifier:
        return jsonify({"status": "error", "message": "No identifier provided"}), 400
    
    success = kick_device(identifier)
    if success:
        return jsonify({"status": "success", "message": f"Device {identifier} kicked"})
    else:
        return jsonify({"status": "error", "message": f"Device {identifier} not found"}), 404

@app.route('/api/update-settings', methods=['POST'])
def update_settings():
    global scan_interval
    data = request.get_json()
    new_interval = data.get('scan_interval')
    
    if new_interval and isinstance(new_interval, int) and new_interval >= 30:
        scan_interval = new_interval
        return jsonify({"status": "success", "message": f"Scan interval updated to {scan_interval} seconds"})
    else:
        return jsonify({"status": "error", "message": "Invalid scan interval"}), 400

if __name__ == '__main__':
    # Print initial hostname for debugging
    hostname = get_local_hostname()
    print(f"Starting application with hostname: {hostname}")
    
    # Initial scan
    scan_network()
    get_network_stats()
    
    # Start the background task before running the app
    initialize()
    
    # Run Flask app
    app.run(host='0.0.0.0', port=5000, debug=True)