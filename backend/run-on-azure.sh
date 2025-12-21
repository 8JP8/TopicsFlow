#!/bin/bash
gunicorn --worker-class eventlet -w 1 --bind=0.0.0.0:8000 --timeout 230 --access-logfile - --error-logfile - app:appp
