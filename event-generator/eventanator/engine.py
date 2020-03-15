import json

EXAMPLE_EVENT_DICT = {
    "name": "Random Event Name",
    "description": "A longer form description (optional)",
    "requirement": { 
        "red": 1, "orange": 2, "yellow": 0, "purple": 0, "green": 3 
    },
    "reward": { 
        "red": 0, "orange": 0, "yellow": 3, "purple": 1, "green": 0 
        },
    "penalty": { 
        "red": 1, "orange": 1, "yellow": 1, "purple": 0, "green": 0 
    }
}

class EventsEngine:
    """
    Principal generator class of events for the Skittles
    game.
    """
    def __init__(self):
        """
        Instantiate with the engine's parameters.
        """
        pass
    
    def generate_random_event(self):
        """
        """
        return Event()


class Event:
    def __init__(self):
        self.data = EXAMPLE_EVENT_DICT

    @property
    def json(self):
        """
        Get the event in JSON format.
        """
        return json.dumps(self.data)
    
    @property
    def dict(self):
        """
        Return the event as a Python dictionary.
        """
        return self.data
