#!/bin/bash
set -e

# BHT Labs MCP Server Deployment Script
# This script simplifies the deployment process to Fly.io

echo "=== BHT Labs MCP Server Deployment ==="
echo

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
    echo "The flyctl command is not installed. Would you like to install it now? (y/n)"
    read -r install_flyctl
    
    if [[ "$install_flyctl" =~ ^[Yy]$ ]]; then
        echo "Installing flyctl..."
        curl -L https://fly.io/install.sh | sh
        
        # Add to PATH for this session
        export PATH="$HOME/.fly/bin:$PATH"
    else
        echo "Please install flyctl manually and run this script again."
        echo "Installation instructions: https://fly.io/docs/hands-on/install-flyctl/"
        exit 1
    fi
fi

# Check if the user is logged in
if ! flyctl auth whoami &> /dev/null; then
    echo "Please log in to Fly.io:"
    flyctl auth login
fi

# Check if the app exists
if ! flyctl apps list | grep -q "bht-labs-remote-mcp"; then
    echo "Creating application..."
    flyctl apps create bht-labs-remote-mcp
fi

# Check if volume exists
if ! flyctl volumes list | grep -q "bht_labs_data"; then
    echo "Creating persistent volume..."
    fly volumes create bht_labs_data --region dfw --size 1
fi

# Ask about authentication
echo "Would you like to set up authentication for the MCP server? (y/n)"
read -r setup_auth

if [[ "$setup_auth" =~ ^[Yy]$ ]]; then
    # Generate a random key
    AUTH_KEY=$(openssl rand -hex 32)
    
    echo "Setting authentication key..."
    flyctl secrets set MCP_AUTH_KEY="$AUTH_KEY"
    
    echo "Your authentication key is: $AUTH_KEY"
    echo "Store this key securely. You'll need it to connect Claude to your MCP server."
    echo
fi

# Deploy the application
echo "Deploying application to Fly.io..."
flyctl deploy

echo
echo "=== Deployment Complete ==="
echo

# Get the application URL
APP_URL=$(flyctl status --json | grep -o '"Hostname": *"[^"]*"' | grep -o '[^"]*$')

echo "Your MCP server is now deployed at: https://$APP_URL"
echo "You can connect to it from Claude using the URL: https://$APP_URL/mcp"

if [[ "$setup_auth" =~ ^[Yy]$ ]]; then
    echo "Don't forget to use your authentication key when connecting from Claude."
fi

echo
echo "To check the status of your application, run:"
echo "  flyctl status"
echo
echo "To view logs:"
echo "  flyctl logs"
echo
echo "Visit the Fly.io dashboard: https://fly.io/apps/bht-labs-remote-mcp"
