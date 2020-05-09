import json
import random
import numpy as np

from lorem import get_sentence

# PARAMETERS
# ----------
# Change these to impact how the parameter passes to the event
# generator influences how many skittles appear in the event.

W0 = 0.6
W1 = 1
W2 = 0

S = lambda x, scale: scale * W0*np.exp(W1*x) + W2*x

# EXAMPLE EVENT
# -------------
# This event can be retrieved by polling api/vi/example

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

# EVENT ENGINE ELEMENTS
# ------------
# Principal components to the engine for creating random events.

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
    
    def generate_random_event(self, scale=1):
        """
        """
        randomness = random.random()
        return Event(scale, randomness)
    
    def get_example(self):
        """
        """
        return ExampleEvent()


class Event:
    def __init__(self, scale, seed=None):
        if not seed is None:
            seed = random.random()
        self._data = self.generate_event(scale, seed)
    
    @property
    def data(self):
        """
        Get the data of the event.
        """
        if self._data is not None:
            return self._data
        else:
            raise Exception('self.data not defined!')


    @property
    def json(self):
        """
        Get the event in JSON format.
        """
        return json.dumps(self.data, indent=2)
    
    @property
    def dict(self):
        """
        Return the event as a Python dictionary.
        """
        return self.data
    
    def generate_event(self, scale, seed):
        """
        Generates the event
        """
        random.seed(seed)

        x = np.random.rand(15)

        skittle = lambda i: int(S(x[i], scale))

        return {
            "name": get_sentence(word_range=(3,4), comma=(0, 0)),
            "description": get_sentence(2, comma=(0, 1)),
            "requirement": { 
                "red": skittle(0), "orange": skittle(1), 
                "yellow": skittle(2), "purple": skittle(3),
                "green": skittle(4)
            },
            "reward": { 
                "red": skittle(5), "orange": skittle(6),
                "yellow": skittle(7), "purple": skittle(8),
                "green": skittle(9) 
                },
            "penalty": { 
                "red": skittle(10), "orange": skittle(11), 
                "yellow": skittle(12), "purple": skittle(13),
                "green": skittle(14)
            }  
        }


class ExampleEvent(Event):
    def __init__(self):
        self.data = EXAMPLE_EVENT_DICT


def calc_mean(event_dict):
    return sum([
        sum([v for v in event_dict[key].values()])
        for key in ['requirement', 'reward', 'penalty']
    ])/15


# Ad-hoc testing
if __name__  == "__main__":
    engine = EventsEngine()
    event = engine.generate_random_event(100)
    print(event.json)

    print('mean:', calc_mean(event.dict))
