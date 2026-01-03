#!/usr/bin/env bash
# Check prerequisites for building the desktop app locally
# Run from repository root or desktop/ folder

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  DnD Toolkit Desktop - Prereq Check"
echo "========================================"
echo ""

ERRORS=0

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓${NC} Node.js installed: $NODE_VERSION"
    
    # Check minimum version (18+)
    MAJOR_VERSION=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        echo -e "  ${YELLOW}⚠ Node.js 18+ recommended (you have $NODE_VERSION)${NC}"
    fi
else
    echo -e "${RED}✗${NC} Node.js not found"
    echo "  Install from: https://nodejs.org/"
    ERRORS=$((ERRORS + 1))
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓${NC} npm installed: v$NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm not found"
    ERRORS=$((ERRORS + 1))
fi

# Check Git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    echo -e "${GREEN}✓${NC} Git installed: v$GIT_VERSION"
else
    echo -e "${RED}✗${NC} Git not found"
    echo "  Install from: https://git-scm.com/"
    ERRORS=$((ERRORS + 1))
fi

# Platform-specific checks
echo ""
echo "Platform-specific requirements:"

case "$(uname -s)" in
    Darwin*)
        # macOS
        echo "Detected: macOS"
        
        # Check Xcode Command Line Tools
        if xcode-select -p &> /dev/null; then
            echo -e "${GREEN}✓${NC} Xcode Command Line Tools installed"
        else
            echo -e "${RED}✗${NC} Xcode Command Line Tools not installed"
            echo "  Run: xcode-select --install"
            ERRORS=$((ERRORS + 1))
        fi
        ;;
    Linux*)
        # Linux
        echo "Detected: Linux"
        
        # Check for common build tools
        if command -v make &> /dev/null && command -v g++ &> /dev/null; then
            echo -e "${GREEN}✓${NC} Build essentials installed"
        else
            echo -e "${YELLOW}⚠${NC} Build tools may be missing"
            echo "  Try: sudo apt install build-essential (Debian/Ubuntu)"
            echo "  Or:  sudo dnf groupinstall 'Development Tools' (Fedora)"
        fi
        
        # Check for RPM tools if on RPM-based distro
        if command -v rpm &> /dev/null; then
            if command -v rpmbuild &> /dev/null; then
                echo -e "${GREEN}✓${NC} rpm-build installed (for .rpm packages)"
            else
                echo -e "${YELLOW}⚠${NC} rpm-build not found (optional, for .rpm packages)"
            fi
        fi
        ;;
    MINGW*|MSYS*|CYGWIN*)
        # Windows (Git Bash, MSYS2, Cygwin)
        echo "Detected: Windows"
        echo -e "${YELLOW}⚠${NC} For native builds, run check-prereqs.ps1 in PowerShell"
        echo "  Or use the GitHub Actions workflow for automated builds"
        ;;
    *)
        echo "Detected: Unknown platform ($(uname -s))"
        ;;
esac

# Check if web build exists
echo ""
echo "Project status:"

if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo -e "${GREEN}✓${NC} Web build exists (dist/)"
else
    echo -e "${YELLOW}⚠${NC} Web build not found"
    echo "  Run: npm run predeploy"
fi

if [ -d "desktop/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Desktop dependencies installed"
else
    echo -e "${YELLOW}⚠${NC} Desktop dependencies not installed"
    echo "  Run: npm run desktop:install"
fi

# Summary
echo ""
echo "========================================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}All prerequisites met!${NC}"
    echo ""
    echo "Quick start:"
    echo "  npm run predeploy        # Build web export"
    echo "  npm run desktop:install  # Install desktop deps (once)"
    echo "  npm run desktop:dev      # Run in dev mode"
    echo "  npm run desktop:dist     # Build installer"
else
    echo -e "${RED}$ERRORS prerequisite(s) missing${NC}"
    echo "Please install the missing items above."
    exit 1
fi
