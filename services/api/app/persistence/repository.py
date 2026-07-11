import hashlib, sqlite3
from pathlib import Path
from uuid import uuid4
from app.domain.models import Claim, ClassificationResult, TranscriptSegment
class Repository:
    def create_session(self,key:str,session_id:str)->str: raise NotImplementedError
    def has_session(self,session_id:str)->bool: raise NotImplementedError
    def save_claim(self,claim:Claim)->None: raise NotImplementedError
    def get_claim(self,public_id:str)->Claim|None: raise NotImplementedError
    def save_transcript(self,session_id:str,segment:TranscriptSegment)->bool: raise NotImplementedError
    def create_claim(self,claim:Claim,result:ClassificationResult)->bool: raise NotImplementedError
class MemoryRepository(Repository):
    def __init__(self): self.sessions={}; self.claims={}; self.transcripts={}; self.claim_results={}
    def create_session(self,key,session_id): return self.sessions.setdefault(key,session_id)
    def has_session(self,session_id): return session_id in self.sessions.values()
    def save_claim(self,claim): self.claims[claim.public_id]=claim.model_copy(deep=True)
    def get_claim(self,public_id): return self.claims.get(public_id)
    def save_transcript(self,session_id,segment):
        key=(session_id,segment.segment_id)
        if key in self.transcripts: return False
        self.transcripts[key]=segment.model_copy(deep=True); return True
    def create_claim(self,claim,result):
        if claim.public_id in self.claims: return False
        self.save_claim(claim); self.claim_results[claim.public_id]=result.model_copy(deep=True); return True
class SQLiteRepository(Repository):
    def __init__(self,path:Path):
        self.db=sqlite3.connect(path,check_same_thread=False); self.db.execute("create table if not exists sessions(id text primary key,idempotency_key text unique)"); self.db.execute("create table if not exists claims(public_id text primary key, body text not null)"); self.db.execute("create table if not exists transcripts(session_id text, segment_id text, body text not null, primary key(session_id,segment_id))")
    def create_session(self,key,session_id):
        self.db.execute("insert or ignore into sessions values(?,?)",(session_id,key)); self.db.commit(); return self.db.execute("select id from sessions where idempotency_key=?",(key,)).fetchone()[0]
    def has_session(self,session_id): return self.db.execute("select 1 from sessions where id=?",(session_id,)).fetchone() is not None
    def save_claim(self,claim): self.db.execute("insert or replace into claims values(?,?)",(claim.public_id,claim.model_dump_json())); self.db.commit()
    def get_claim(self,public_id):
        row=self.db.execute("select body from claims where public_id=?",(public_id,)).fetchone(); return Claim.model_validate_json(row[0]) if row else None
    def save_transcript(self,session_id,segment):
        cursor=self.db.execute("insert or ignore into transcripts values(?,?,?)",(session_id,segment.segment_id,segment.model_dump_json())); self.db.commit(); return cursor.rowcount==1
    def create_claim(self,claim,result):
        if self.get_claim(claim.public_id): return False
        self.save_claim(claim); return True

class PostgresRepository(Repository):
    def __init__(self, database_url: str):
        import psycopg
        self.db = psycopg.connect(database_url)

    def create_session(self, key: str, session_id: str) -> str:
        with self.db.transaction():
            row = self.db.execute(
                """INSERT INTO sessions (id, idempotency_key, video_url)
                   VALUES (%s, %s, %s)
                   ON CONFLICT (idempotency_key) DO UPDATE
                   SET idempotency_key = EXCLUDED.idempotency_key
                   RETURNING id::text""",
                (session_id, key, "https://youtube.com/watch?v=hero"),
            ).fetchone()
        return row[0]

    def has_session(self, session_id: str) -> bool:
        return self.db.execute("SELECT 1 FROM sessions WHERE id=%s", (session_id,)).fetchone() is not None

    def save_claim(self, claim: Claim) -> None:
        from psycopg.types.json import Jsonb
        digest = hashlib.sha256(claim.normalized_text.encode()).hexdigest()
        with self.db.transaction():
            self.db.execute(
                """INSERT INTO claims
                   (id, public_id, session_id, idempotency_key, speaker_label,
                    exact_text, normalized_text, normalized_claim_hash, start_ms,
                    end_ms, classification, state, created_at, completed_at, body)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (public_id) DO UPDATE SET
                    state=EXCLUDED.state, completed_at=EXCLUDED.completed_at,
                    body=EXCLUDED.body""",
                (str(uuid4()), claim.public_id, claim.session_id, claim.public_id,
                 claim.speaker_label, claim.exact_text, claim.normalized_text,
                 digest, claim.start_ms, claim.end_ms, claim.classification.value,
                 claim.state.value, claim.created_at, claim.completed_at,
                 Jsonb(claim.model_dump(mode="json"))),
            )

    def get_claim(self, public_id: str) -> Claim | None:
        row = self.db.execute(
            "SELECT body FROM claims WHERE public_id=%s", (public_id,)
        ).fetchone()
        return Claim.model_validate(row[0]) if row else None

    def save_transcript(self, session_id: str, segment: TranscriptSegment) -> bool:
        from psycopg.types.json import Jsonb
        with self.db.transaction():
            row = self.db.execute(
                """INSERT INTO transcript_segments
                   (session_id, segment_id, speaker, text, start_ms, end_ms, body)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (session_id, segment_id) DO NOTHING RETURNING segment_id""",
                (session_id, segment.segment_id, segment.speaker, segment.text,
                 segment.start_ms, segment.end_ms, Jsonb(segment.model_dump(mode="json"))),
            ).fetchone()
        return row is not None

    def create_claim(self, claim: Claim, result: ClassificationResult) -> bool:
        from psycopg.types.json import Jsonb
        claim_id = str(uuid4())
        claim_hash = hashlib.sha256(claim.normalized_text.encode()).hexdigest()
        with self.db.transaction():
            row = self.db.execute(
                """INSERT INTO claims
                   (id, public_id, session_id, idempotency_key, speaker_label,
                    exact_text, normalized_text, normalized_claim_hash, start_ms,
                    end_ms, classification, state, created_at, completed_at, body)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT DO NOTHING RETURNING public_id""",
                (claim_id, claim.public_id, claim.session_id, claim.public_id,
                 claim.speaker_label, claim.exact_text, claim.normalized_text,
                 claim_hash, claim.start_ms, claim.end_ms, claim.classification.value,
                 claim.state.value, claim.created_at, claim.completed_at,
                 Jsonb(claim.model_dump(mode="json"))),
            ).fetchone()
        return row is not None

    def close(self) -> None:
        self.db.close()
