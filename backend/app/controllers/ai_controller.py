from fastapi import APIRouter, HTTPException
import dotenv
import httpx

dotenv.load_dotenv(".env")

router = APIRouter()    

'''
This controller will handle endpoints related to AI analysis of F1 data, such as:
1. 
'''

print("AI API Key:", dotenv.get_key(".env", "AI_API")) #test to see if we can read the API key from the .env file

