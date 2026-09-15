import asyncio, uuid
from app.database import get_pool

async def check_emotions():
    pool = await get_pool()
    async with pool.acquire() as db:
        sess_id = uuid.UUID('efca4130-bb2a-45cc-8d8a-afd0880b8e9b')
        iea = await db.fetch('SELECT * FROM interview_emotion_analysis WHERE session_id = $1', sess_id)
        print('interview_emotion_analysis count:', len(iea))
        if iea:
            print('Sample row in interview_emotion_analysis:', dict(iea[0]))
        
        eae = await db.fetch('SELECT * FROM emotion_analysis_events WHERE session_id = $1', sess_id)
        print('emotion_analysis_events count:', len(eae))
        if eae:
            print('Sample row in emotion_analysis_events:', dict(eae[0]))

        ear = await db.fetch('SELECT * FROM emotion_analysis_results WHERE session_id = $1', sess_id)
        print('emotion_analysis_results count:', len(ear))
        if ear:
            print('Sample row in emotion_analysis_results:', dict(ear[0]))

        all_iea = await db.fetch('SELECT session_id, count(*) as cnt FROM interview_emotion_analysis GROUP BY session_id')
        print('All sessions in interview_emotion_analysis:', [(str(r['session_id']), r['cnt']) for r in all_iea])

        all_eae = await db.fetch('SELECT session_id, count(*) as cnt FROM emotion_analysis_events GROUP BY session_id')
        print('All sessions in emotion_analysis_events:', [(str(r['session_id']), r['cnt']) for r in all_eae])

asyncio.run(check_emotions())
