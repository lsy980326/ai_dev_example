WITH schedule AS (
  SELECT (date_trunc('week',now() AT TIME ZONE 'Asia/Seoul') + interval '11 days 19 hours 30 minutes') AT TIME ZONE 'Asia/Seoul' AS starts
)
INSERT INTO study_session(id,title,description,starts_at,closes_at,capacity)
SELECT 17,'금요일 시스템 설계 스터디','서비스가 커지기 전에 함께 생각해 볼 것들. 각자의 설계 경험을 나누고, 작은 서비스의 구조를 같이 그려 봅니다.',starts,starts-interval '90 minutes',8 FROM schedule
UNION ALL SELECT 18,'더 나은 API를 만드는 시간','인증과 오류 응답, 읽기 쉬운 계약까지. 실무에서 만난 API의 고민을 함께 나눕니다.',starts+interval '1 day',starts+interval '1 day'-interval '90 minutes',12 FROM schedule
UNION ALL SELECT 19,'PostgreSQL 동시성 읽기 모임','같은 데이터에 여러 요청이 도착할 때, 어떤 결과를 보장할 수 있을까요?',starts+interval '2 days',starts+interval '2 days'-interval '90 minutes',8 FROM schedule
UNION ALL SELECT 20,'지난 모임 다시 돌아보기','함께 나눈 이야기를 정리하는 모임입니다. 이번 신청은 마감되었습니다.',now()+interval '1 hour',now()-interval '1 hour',10;
INSERT INTO registration(session_id,member_subject,created_at)
SELECT s.id,'seed-'||n,now() FROM study_session s CROSS JOIN generate_series(1,8) n
WHERE (s.id=17 AND n<=7) OR s.id IN(18,19) OR (s.id=20 AND n<=2);
SELECT setval(pg_get_serial_sequence('study_session','id'),20,true);
