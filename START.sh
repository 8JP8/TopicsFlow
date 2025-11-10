#!/bin/bash

# ChatHub Application Starter Script
# This script sets up and starts the ChatHub application with all services

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        echo "Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi

    print_success "Docker and Docker Compose are installed"
}

# Check if required ports are available
check_ports() {
    local ports=("27017" "6379" "5000" "3000")
    local occupied_ports=()

    for port in "${ports[@]}"; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            occupied_ports+=($port)
        fi
    done

    if [ ${#occupied_ports[@]} -ne 0 ]; then
        print_warning "The following ports are already in use: ${occupied_ports[*]}"
        print_warning "This might cause conflicts with ChatHub services."
        read -p "Do you want to continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Setup cancelled due to port conflicts."
            exit 1
        fi
    fi
}

# Create environment file if it doesn't exist
setup_env_file() {
    if [ ! -f .env ]; then
        print_status "Creating .env file with default values..."
        cat > .env << EOF
# ChatHub Environment Variables
# Generate secure values for production

# Database Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=change_this_password_in_production
REDIS_PASSWORD=change_this_redis_password_in_production

# Application Configuration
FLASK_SECRET_KEY=generate_a_secure_random_key_here
FRONTEND_URL=http://localhost:3000

# External API Keys (optional)
SMS_SERVICE_API_KEY=your_twilio_api_key
EMAIL_SERVICE_API_KEY=your_sendgrid_api_key
TENOR_API_KEY=your_tenor_api_key

# Development vs Production
NODE_ENV=development
EOF
        print_success "Created .env file"
        print_warning "Please update the values in .env file before running in production!"
    else
        print_status ".env file already exists"
    fi
}

# Create directories for persistent data
create_directories() {
    print_status "Creating directories for persistent data..."
    mkdir -p scripts
    mkdir -p nginx
    mkdir -p nginx/logs
    mkdir -p nginx/ssl
    mkdir -p secrets
    mkdir -p backend/keys

    # Create secrets directory structure
    touch secrets/mongo_root_username.txt
    touch secrets/mongo_root_password.txt
    touch secrets/flask_secret_key.txt
    touch secrets/redis_password.txt
    touch secrets/sms_service_api_key.txt
    touch secrets/email_service_api_key.txt
    touch secrets/tenor_api_key.txt

    print_success "Created required directories"
}

# Create MongoDB initialization script
create_mongo_init() {
    if [ ! -f scripts/mongo-init.js ]; then
        print_status "Creating MongoDB initialization script..."
        cat > scripts/mongo-init.js << 'EOF'
// MongoDB initialization script for ChatHub
db = db.getSiblingDB('chatapp');

// Create indexes for better performance
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "ip_addresses": 1 });

db.topics.createIndex({ "created_at": 1 });
db.topics.createIndex({ "member_count": -1 });
db.topics.createIndex({ "last_activity": -1 });
db.topics.createIndex({ "tags": 1 });

db.messages.createIndex({ "topic_id": 1, "created_at": -1 });
db.messages.createIndex({ "user_id": 1 });
db.messages.createIndex({ "created_at": 1 });

db.reports.createIndex({ "topic_id": 1, "status": 1 });
db.reports.createIndex({ "created_at": 1 });

db.private_messages.createIndex({ "from_user_id": 1, "to_user_id": 1 });
db.private_messages.createIndex({ "to_user_id": 1, "created_at": -1 });
db.private_messages.createIndex({ "created_at": 1 });

db.anonymous_identities.createIndex({ "user_id": 1, "topic_id": 1 }, { unique: true });

print('MongoDB indexes created successfully');
EOF
        print_success "Created MongoDB initialization script"
    else
        print_status "MongoDB initialization script already exists"
    fi
}

# Start services
start_services() {
    print_status "Starting ChatHub services..."

    # Build and start with Docker Compose
    docker-compose up --build -d

    if [ $? -eq 0 ]; then
        print_success "ChatHub services started successfully!"
        print_status "Services are running in the background."
        echo
        print_status "Service URLs:"
        echo "  • Frontend: http://localhost:3000"
        echo "  • Backend API: http://localhost:5000"
        echo "  • MongoDB: localhost:27017"
        echo "  • Redis: localhost:6379"
        echo
        print_status "To view logs: docker-compose logs -f"
        print_status "To stop services: docker-compose down"
        print_status "To restart services: docker-compose restart"
    else
        print_error "Failed to start services. Check the logs above."
        exit 1
    fi
}

# Wait for services to be healthy
wait_for_services() {
    print_status "Waiting for services to be ready..."

    # Wait for MongoDB
    print_status "Waiting for MongoDB..."
    for i in {1..30}; do
        if docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
            print_success "MongoDB is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "MongoDB failed to start within 30 seconds"
            return 1
        fi
        sleep 1
    done

    # Wait for Backend
    print_status "Waiting for Backend API..."
    for i in {1..30}; do
        if curl -f http://localhost:5000/health >/dev/null 2>&1; then
            print_success "Backend API is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Backend API failed to start within 30 seconds"
            return 1
        fi
        sleep 1
    done

    # Wait for Frontend
    print_status "Waiting for Frontend..."
    for i in {1..30}; do
        if curl -f http://localhost:3000 >/dev/null 2>&1; then
            print_success "Frontend is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Frontend failed to start within 30 seconds"
            return 1
        fi
        sleep 1
    done
}

# Show next steps
show_next_steps() {
    echo
    print_success "🎉 ChatHub is now running!"
    echo
    echo "Next steps:"
    echo "1. Open your browser and go to http://localhost:3000"
    echo "2. Create a new account"
    echo "3. Set up two-factor authentication with your authenticator app"
    echo "4. Start chatting!"
    echo
    echo "Useful commands:"
    echo "  • View logs: docker-compose logs -f [service-name]"
    echo "  • Stop services: docker-compose down"
    echo "  • Restart services: docker-compose restart"
    echo "  • Update services: docker-compose up --build"
    echo
    echo "For production deployment:"
    echo "  • Update .env file with secure values"
    echo "  • Use docker-compose.prod.yml"
    echo "  • Set up SSL certificates"
    echo "  • Configure your domain and DNS"
}

# Main execution
main() {
    echo "🚀 ChatHub Application Setup & Start Script"
    echo "=========================================="
    echo

    check_docker
    check_ports
    setup_env_file
    create_directories
    create_mongo_init
    start_services

    # Wait a moment for services to start
    sleep 5

    if wait_for_services; then
        show_next_steps
    else
        print_error "Some services failed to start properly."
        print_status "Check the logs with: docker-compose logs"
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    "stop")
        print_status "Stopping ChatHub services..."
        docker-compose down
        print_success "Services stopped"
        ;;
    "restart")
        print_status "Restarting ChatHub services..."
        docker-compose restart
        print_success "Services restarted"
        ;;
    "logs")
        docker-compose logs -f
        ;;
    "prod")
        print_status "Starting ChatHub in production mode..."
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
        ;;
    "clean")
        print_status "Cleaning up ChatHub services and data..."
        docker-compose down -v
        docker system prune -f
        print_success "Cleanup completed"
        ;;
    "help"|"-h"|"--help")
        echo "ChatHub Setup Script"
        echo "Usage: $0 [COMMAND]"
        echo
        echo "Commands:"
        echo "  (no args)  Start services in development mode"
        echo "  stop       Stop all services"
        echo "  restart    Restart all services"
        echo "  logs       Show logs for all services"
        echo "  prod       Start services in production mode"
        echo "  clean      Stop services and remove all data"
        echo "  help       Show this help message"
        ;;
    *)
        main
        ;;
esac