import os
from fastapi import FastAPI

from eventanator.engine import EventsEngine

app = FastAPI()
engine = EventsEngine()


@app.get('/')
def hello_world():
    return "Hello from the Event Generator!"


@app.get('/api/v1/event/{scale}')
async def random_event(scale):
    event = engine.generate_random_event(float(scale))
    return event.dict


@app.get('api/v1/example')
def get_example():
    example_event = engine.get_example()
    return example_event.dict
