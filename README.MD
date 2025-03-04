# 🌐 Network Guardian

![Network Guardian](https://raw.githubusercontent.com/BlackCat-443/Network-Guardian/main/images/images.png)

## 📱 A powerful network monitoring and control application

Network Guardian is a web-based dashboard that gives you complete visibility and control over your local network. Monitor connected devices, track network traffic, and manage unwanted connections - all from a simple and intuitive interface.

## ✨ Features

- **Real-time Device Discovery**: Automatically scan and detect all devices connected to your network
- **Traffic Monitoring**: Track upload and download rates with historical data visualization
- **System Information**: View detailed information about your system and network configuration
- **Access Control**:
  - 🚫 Block Devices: Prevent specific devices from accessing your network *(Still in development)*
  - 🛢️ Kick Devices: Temporarily disconnect devices from your network *(Still in development)*
- **Customizable Scanning**: Adjust scan intervals based on your needs
- **Responsive Dashboard**: Access from any device with a web browser

> **🇙️ Note:** The **Kick and Block Hostname** features are still under development and may not work as expected. Future updates will enhance these functionalities.

## 🚀 Quick Start

### Prerequisites

- Python 3.6+
- pip (Python package manager)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/BlackCat-443/Network-Guardian.git
   cd network-guardian
   ```
2. (Optional) If you encounter issues, use a virtual environment:
   ```
   python3 -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
3. Install the required packages:
   ```
   pip install -r requirements.txt
   ```
4. Run the application:
   ```
   python app.py
   ```
5. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

> ⚠️ **Note:** Some features like blocking and kicking devices require administrative privileges. On Linux/Mac, run with `sudo python app.py` for full functionality.

## 🛠️ Dashboard Pages

### 💻 Devices Page

![Devices Page](https://raw.githubusercontent.com/BlackCat-443/Network-Guardian/main/images/devices.png)

- Displays all detected devices on the network
- Shows IP addresses, MAC addresses, and connection status
- Provides options to **Block** or **Kick** devices *(in development)*

### 🌐 Network Settings Page

![Settings Page](https://raw.githubusercontent.com/BlackCat-443/Network-Guardian/main/images/settings.png)

- Customize scan intervals
- Adjust network monitoring preferences
- Toggle security settings

### 📊 Real-time Traffic Chart

![Live Traffic](https://raw.githubusercontent.com/BlackCat-443/Network-Guardian/main/images/live_traffic.png)

- Displays real-time upload and download activity
- Helps in identifying bandwidth usage spikes

### 📊 System Information Page

![System Info](https://raw.githubusercontent.com/BlackCat-443/Network-Guardian/main/images/system_info.png)

- Displays system resource usage
- Shows active network interfaces
- Provides details on network configurations

### 📊 Connected Clients Page

![Connected Clients](https://raw.githubusercontent.com/BlackCat-443/Network-Guardian/main/images/connected_clients.png)

- Lists all currently connected devices
- Displays hostname, IP, and MAC addresses
- Shows active bandwidth usage

## 🔧 Requirements

The following Python packages are required:

- Flask
- nmap-python
- psutil
- netifaces

You can install all dependencies using:

```
pip install flask python-nmap psutil netifaces
```

## 🛡️ How It Works

### Device Blocking *(Still in Development)*

Network Guardian plans to use different methods based on your operating system:

- **Linux**: Uses iptables or arptables to block traffic from specified devices
- **Windows**: Creates Windows Firewall rules to block inbound and outbound connections

### Device Kicking *(Still in Development)*

- **Linux**: Uses ARP spoofing techniques to temporarily disconnect target devices
- **Windows**: Temporarily blocks and then unblocks devices after a short period

## 📊 API Endpoints

All features are accessible through REST API endpoints:

- `GET /api/devices` - List all discovered devices
- `GET /api/stats` - Get current network statistics
- `GET /api/traffic-history` - Get historical traffic data
- `GET /api/scan` - Trigger an immediate network scan
- `POST /api/block-device` - Block a device *(Still in Development)*
- `POST /api/unblock-device` - Unblock a device *(Still in Development)*
- `POST /api/kick-device` - Temporarily disconnect a device *(Still in Development)*

## 🔒 Security Considerations

This tool is intended for use on networks you own or have permission to monitor. Using Network Guardian on unauthorized networks may violate local laws and regulations.

## 📌 Author

**Banh_Code** - Creator and Developer of Network Guardian

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

If you have any questions or need help, please open an issue in the GitHub repository.

## 💾 Download

[**💾 Download Network Guardian**](https://github.com/BlackCat-443/Network-Guardian.git/releases/latest)


