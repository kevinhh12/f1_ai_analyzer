from fastapi import APIRouter, HTTPException
import httpx

router = APIRouter()


'''
This controller provides endpoints to fetch F1 data from the OpenF1 API. It includes
1. Health check endpoint to verify the API is running.
2. Endpoint to list drivers in a season. 
3. Endpoint to list races in a season.
4. Endpoint to get lap times for a session, optionally filtered by driver.
5. 
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
def list_races(season: int):
    '''
    List races in a season (year). 
    '''
    response = httpx.get(f"{data_url}/sessions?year={season}&session_name=Race")

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text
        )
    
    races = response.json()

    return {"season": season, "races": races}

@router.get("/drivers")
def list_drivers( session_key: int):
    '''
    List drivers in a session.
    '''
    response = httpx.get(f"{data_url}/drivers?session_key={session_key}")

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text
        )
    
    drivers = response.json()

    return {"session_key": session_key, "drivers": drivers}

@router.get("/laps")
def get_lap_times(session_key: int, driver_number: int = None):
    '''
    Get lap times for a session, optionally filtered by driver.
    session_key is returned by the /races endpoint.
    '''
    url = f"{data_url}/laps?session_key={session_key}"
    if driver_number is not None:
        url += f"&driver_number={driver_number}"

    response = httpx.get(url, timeout=30.0)

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text
        )

    return {"session_key": session_key, "lap_times": response.json()}

@router.get("/position")
def get_position(session_key: int, driver_number: int = None):
    '''
    Get the position of a driver in a session.
    '''
    url = f"{data_url}/position?session_key={session_key}"
    if driver_number is not None:
        url += f"&driver_number={driver_number}"

    response = httpx.get(url, timeout=30.0)

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text
        )

    return {"session_key": session_key, "position": response.json()}