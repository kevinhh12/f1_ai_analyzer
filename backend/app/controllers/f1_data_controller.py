from fastapi import APIRouter, HTTPException
import httpx

router = APIRouter()
'''
GET  /health                          # Health check
GET  /races?season={year}             # List races in a season
GET  /laps/{season}/{race}            # Lap times by driver
GET  /tyres/{season}/{race}           # Tyre strategy + stint data
GET  /pitstops/{season}/{race}        # Pit stop laps + durations
'''

data_url = "https://api.openf1.org/v1"

@router.get("/health")

def health():
    '''
    tests the API is up and running, and can be used by monitoring tools or load balancers to check the health of the service.
    '''
    return {"status": "ok",
            "message": "F1 AI Analyzer API is healthy"}

@router.get("/races")
def list_races(year: int):
    '''
    List races in a season (year). 
    '''
    response = httpx.get(f"{data_url}/sessions?year={year}&session_name=Race")

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text
        )
    
    races = response.json()

    return {"season": year, "races": races}


