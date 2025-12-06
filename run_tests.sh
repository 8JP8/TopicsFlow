#!/bin/bash
# TopicsFlow Backend API Test Runner
# This script clears test data and runs Postman collection tests

echo "========================================"
echo "TopicsFlow Backend API Test Suite"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo -e "${YELLOW}[WARNING]${NC} Python not found. Skipping database cleanup."
    echo "You may need to manually clear test data from MongoDB."
    SKIP_CLEANUP=true
else
    SKIP_CLEANUP=false
fi

# Step 1: Clear test data from database
if [ "$SKIP_CLEANUP" = false ]; then
    echo "[1/4] Clearing test data from database..."
    echo ""
    if command -v python3 &> /dev/null; then
        python3 clear_test_data.py
    else
        python clear_test_data.py
    fi
    
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}[WARNING]${NC} Failed to clear test data. Continuing anyway..."
        echo ""
    fi
    echo ""
fi

# Step 2: Check if Newman is installed
echo "[2/4] Checking Newman installation..."
if ! command -v newman &> /dev/null; then
    echo "Newman not found. Installing..."
    npm install -g newman
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR]${NC} Failed to install Newman"
        exit 1
    fi
fi
echo -e "${GREEN}✓${NC} Newman is installed"
echo ""

# Step 3: Check if HTML reporter is installed
echo "[3/4] Checking HTML reporter..."
if ! npm list -g newman-reporter-html &> /dev/null; then
    echo "HTML reporter not found. Installing..."
    npm install -g newman-reporter-html
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}[WARNING]${NC} Failed to install HTML reporter. Tests will run without HTML report."
    else
        echo -e "${GREEN}✓${NC} HTML reporter installed"
    fi
else
    echo -e "${GREEN}✓${NC} HTML reporter is installed"
fi
echo ""

# Step 4: Create reports directory if it doesn't exist
mkdir -p Tests/reports

# Step 5: Run Postman collection tests
echo "[4/4] Running Postman collection tests..."
echo ""
echo "========================================"
echo "Running Tests..."
echo "========================================"
echo ""

newman run Tests/postman/TopicsFlow_Backend_API.postman_collection.json \
    -e Tests/postman/environments/Local.postman_environment.json \
    -r html,cli \
    --reporter-html-export Tests/reports/report.html \
    --delay-request 500

TEST_EXIT_CODE=$?

echo ""
echo "========================================"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
else
    echo -e "${RED}✗ Some tests failed. Exit code: $TEST_EXIT_CODE${NC}"
fi
echo "========================================"
echo ""
echo "Test report saved to: Tests/reports/report.html"
echo ""

# Open report in browser (optional - uncomment if desired)
# if [ -f "Tests/reports/report.html" ]; then
#     echo "Opening test report in browser..."
#     if command -v xdg-open &> /dev/null; then
#         xdg-open Tests/reports/report.html
#     elif command -v open &> /dev/null; then
#         open Tests/reports/report.html
#     fi
# fi

exit $TEST_EXIT_CODE
