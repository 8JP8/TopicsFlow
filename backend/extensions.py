from flask_socketio import SocketIO
from flask_cors import CORS
from flask_session import Session

# Initialize extensions
socketio = SocketIO()
cors = CORS()
session = Session()
