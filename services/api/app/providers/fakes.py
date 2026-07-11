import json
from pathlib import Path
ROOT=Path(__file__).parents[4]
class FakeProviders:
    async def hero(self): return json.loads((ROOT/"fixtures/hero-demo/hero.json").read_text())
    async def push(self,public_id:str): return {"delivered":True,"url":f"/claims/{public_id}"}
