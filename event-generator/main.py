import os
from fastapi import FastAPI

from eventanator.engine import EventsEngine

app = FastAPI()
engine = EventsEngine()


@app.get('/')
def hello_world():
    return "Hello, World!"


@app.get('/api/v1/event')
def random_event():
    event = engine.generate_random_event()
    return event.dict
