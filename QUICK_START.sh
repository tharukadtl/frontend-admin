#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   SLT Admin Portal — Quick Start Script                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js detected: $(node --version)"
echo "✅ npm detected: $(npm --version)"
echo ""

# Check if in correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found."
    echo "   Please run this script from the slt-admin-portal directory."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
echo "   This may take 2-3 minutes..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ npm install failed. Please check errors above."
    exit 1
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   Ready to Start!                                            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "🚀 Starting development server..."
echo "   Open http://localhost:3000 in your browser"
echo ""
echo "📝 Default credentials:"
echo "   Username: superadmin"
echo "   Password: admin123"
echo ""
echo "⏸️  Press Ctrl+C to stop the server"
echo ""

# Start development server
npm start
