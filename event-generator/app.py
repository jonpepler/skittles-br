import os
from flask import Flask

from eventanator.engine import EventsEngine

PORT = os.getenv("PORT")

app = Flask(__name__)

engine = EventsEngine()


@app.route('/')
def hello_world():
    return "Hello, World!"


@app.route('/api/v1/event')
def random_event():
    event = engine.generate_random_event()
    return event.json


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=PORT)
