from flask import Flask, render_template, request, jsonify, session
import openai
import os
from datetime import datetime, timedelta
import json
import uuid
import re

app = Flask(__name__)
app.secret_key = 'palearn-secret-key-2025'

import private
# OpenAI API 설정
openai.api_key = private.private.gpt_key

# 메모리 데이터베이스 (실제 운영시엔 DB 사용)
users_db = {}
plans_db = {}
daily_progress_db = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    name = data.get('name')
    username = data.get('username')
    password = data.get('password')
    birthday = data.get('birthday')
    
    if username in users_db:
        return jsonify({'success': False, 'message': '이미 존재하는 사용자명입니다.'})
    
    user_id = str(uuid.uuid4())
    users_db[username] = {
        'id': user_id,
        'name': name,
        'username': username,
        'password': password,
        'birthday': birthday,
        'created_at': datetime.now().isoformat()
    }
    
    session['user_id'] = user_id
    session['username'] = username
    
    return jsonify({'success': True, 'message': '회원가입이 완료되었습니다.'})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if username not in users_db or users_db[username]['password'] != password:
        return jsonify({'success': False, 'message': '아이디 또는 비밀번호가 틀렸습니다.'})
    
    session['user_id'] = users_db[username]['id']
    session['username'] = username
    
    return jsonify({'success': True, 'message': '로그인 성공'})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/user-info')
def get_user_info():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
    
    username = session['username']
    user = users_db[username]
    
    # 사용자의 계획들 가져오기
    user_plans = []
    for plan_id, plan in plans_db.items():
        if plan['user_id'] == session['user_id']:
            user_plans.append(plan)
    
    return jsonify({
        'success': True,
        'user': user,
        'plans': user_plans
    })

@app.route('/api/generate-quiz', methods=['POST'])
def generate_quiz():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
    
    data = request.json
    skill = data.get('skill')
    knowledge_level = data.get('knowledge_level')
    
    try:
        response = openai.responses.create(
            model="gpt-4o",
            tools=[{"type": "web_search_preview"}],
            input=f"""당신은 사용자의 실력을 정확히 파악하기 위한 O/X 퀴즈를 생성하는 전문가입니다. 
            스킬: {skill}, 자가평가 수준: {knowledge_level}에 대한 실력 측정용 O/X 퀴즈 10문제를 만들어주세요.
            
            응답은 반드시 다음 JSON 형식으로 해주세요:
            {{
                "questions": [
                    {{
                        "id": 1,
                        "question": "문제 내용",
                        "answer": true 또는 false,
                        "difficulty": "beginner/intermediate/advanced",
                        "explanation": "정답 해설"
                    }}
                ]
            }}"""
        )
        
        quiz_content = response.output_text
        
        # JSON 파싱 시도
        try:
            # JSON 부분만 추출
            json_start = quiz_content.find('{')
            json_end = quiz_content.rfind('}') + 1
            if json_start != -1 and json_end != -1:
                json_str = quiz_content[json_start:json_end]
                quiz_data = json.loads(json_str)
            else:
                raise ValueError("JSON not found")
        except:
            # JSON 파싱 실패시 기본 퀴즈 생성
            quiz_data = {"questions": []}
            for i in range(1, 11):
                quiz_data["questions"].append({
                    "id": i,
                    "question": f"{skill} 관련 기초 문제 {i}: 이 기술을 사용할 때 중요한 것은 기본 개념을 이해하는 것이다.",
                    "answer": True if i % 2 == 0 else False,
                    "difficulty": "beginner",
                    "explanation": "기본 개념 이해는 모든 기술 학습의 기초입니다."
                })
        
        return jsonify({
            'success': True,
            'quiz': quiz_data
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'퀴즈 생성 중 오류가 발생했습니다: {str(e)}'})

@app.route('/api/analyze-quiz-result', methods=['POST'])
def analyze_quiz_result():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
    
    data = request.json
    skill = data.get('skill')
    quiz_answers = data.get('answers')
    correct_count = data.get('correct_count')
    
    try:
        response = openai.responses.create(
            model="gpt-4o",
            tools=[{"type": "web_search_preview"}],
            input=f"""당신은 학습 코스 추천 전문가입니다. 사용자의 퀴즈 결과를 바탕으로 적절한 수준의 강좌나 책을 웹에서 찾아 추천해주세요.
            
            스킬: {skill}
            퀴즈 정답률: {correct_count}/10
            
            최신 한국어 학습 자료를 우선으로 해서 추천해주세요. 응답은 반드시 다음 JSON 형식으로 해주세요:
            {{
                "level_analysis": "사용자 수준 분석",
                "recommendations": [
                    {{
                        "title": "강좌/책 제목",
                        "type": "course 또는 book",
                        "description": "간단한 설명",
                        "duration": "예상 소요시간",
                        "difficulty": "beginner/intermediate/advanced",
                        "url": "링크 (있다면)",
                        "chapters": ["챕터1", "챕터2", "챕터3"],
                        "image_url": "이미지 URL (있다면)"
                    }}
                ]
            }}"""
        )
        
        recommendations_content = response.output_text
        
        try:
            # JSON 부분만 추출
            json_start = recommendations_content.find('{')
            json_end = recommendations_content.rfind('}') + 1
            if json_start != -1 and json_end != -1:
                json_str = recommendations_content[json_start:json_end]
                recommendations_data = json.loads(json_str)
            else:
                raise ValueError("JSON not found")
        except:
            # 기본 추천 데이터
            level_desc = "초급" if correct_count < 4 else "중급" if correct_count < 7 else "고급"
            recommendations_data = {
                "level_analysis": f"{skill} 분야에서 {correct_count}/10 정답률을 보이셨습니다. {level_desc} 수준으로 판단됩니다.",
                "recommendations": [
                    {
                        "title": f"{skill} 기초 완성 과정",
                        "type": "course",
                        "description": "기초부터 체계적으로 학습하는 실전 과정",
                        "duration": "4-6주",
                        "difficulty": level_desc.lower().replace("급", ""),
                        "url": "",
                        "chapters": ["기초 개념", "실습", "프로젝트", "심화 학습"],
                        "image_url": ""
                    },
                    {
                        "title": f"{skill} 실무 활용서",
                        "type": "book",
                        "description": "실무에서 바로 활용 가능한 예제 중심 도서",
                        "duration": "3-4주",
                        "difficulty": level_desc.lower().replace("급", ""),
                        "url": "",
                        "chapters": ["기본 문법", "실전 예제", "프로젝트"],
                        "image_url": ""
                    },
                    {
                        "title": f"{skill} 온라인 강의",
                        "type": "course",
                        "description": "단계별 학습이 가능한 온라인 강의",
                        "duration": "5-8주",
                        "difficulty": level_desc.lower().replace("급", ""),
                        "url": "",
                        "chapters": ["입문", "기초", "응용", "실전"],
                        "image_url": ""
                    }
                ]
            }
        
        return jsonify({
            'success': True,
            'analysis': recommendations_data
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'분석 중 오류가 발생했습니다: {str(e)}'})

@app.route('/api/create-study-plan', methods=['POST'])
def create_study_plan():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
    
    data = request.json
    selected_course = data.get('selected_course')
    daily_hours = data.get('daily_hours')
    rest_days = data.get('rest_days', [])
    start_date = data.get('start_date')
    
    try:
        response = openai.responses.create(
            model="gpt-4o",
            input=f"""당신은 개인 맞춤형 학습 계획 생성 전문가입니다. 
            선택된 강좌/책 정보와 사용자의 일일 가능 시간을 바탕으로 상세한 학습 계획을 세워주세요.
            
            선택된 과정: {json.dumps(selected_course, ensure_ascii=False)}
            일일 가능 시간: {daily_hours}시간
            휴식일: {rest_days}
            시작일: {start_date}
            
            응답은 반드시 다음 JSON 형식으로 해주세요:
            {{
                "total_duration": "총 예상 기간",
                "daily_plan": [
                    {{
                        "day": 1,
                        "date": "2025-07-25",
                        "tasks": [
                            {{
                                "task": "할 일",
                                "duration": "소요시간",
                                "type": "lecture/reading/practice/review",
                                "url": "링크 (있다면)"
                            }}
                        ]
                    }}
                ]
            }}"""
        )
        
        plan_content = response.output_text
        
        try:
            # JSON 부분만 추출
            json_start = plan_content.find('{')
            json_end = plan_content.rfind('}') + 1
            if json_start != -1 and json_end != -1:
                json_str = plan_content[json_start:json_end]
                plan_data = json.loads(json_str)
            else:
                raise ValueError("JSON not found")
        except:
            # 기본 계획 생성
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            plan_data = {
                "total_duration": "4주",
                "daily_plan": []
            }
            
            day_count = 0
            for i in range(28):  # 4주
                current_date = start_dt + timedelta(days=i)
                weekday = current_date.strftime('%A').lower()
                
                # 휴식일 체크
                if weekday not in [day.lower() for day in rest_days]:
                    day_count += 1
                    tasks = []
                    
                    # 일일 학습 시간을 나눠서 태스크 생성
                    if daily_hours >= 2:
                        tasks.append({
                            "task": f"{selected_course['title']} - 이론 학습",
                            "duration": f"{daily_hours//2}시간",
                            "type": "lecture",
                            "url": selected_course.get('url', '')
                        })
                        tasks.append({
                            "task": f"{selected_course['title']} - 실습/복습",
                            "duration": f"{daily_hours - daily_hours//2}시간",
                            "type": "practice",
                            "url": ""
                        })
                    else:
                        tasks.append({
                            "task": f"{selected_course['title']} - Day {day_count} 학습",
                            "duration": f"{daily_hours}시간",
                            "type": "lecture",
                            "url": selected_course.get('url', '')
                        })
                    
                    plan_data["daily_plan"].append({
                        "day": day_count,
                        "date": current_date.strftime('%Y-%m-%d'),
                        "tasks": tasks
                    })
        
        # 계획 저장
        plan_id = str(uuid.uuid4())
        plans_db[plan_id] = {
            'id': plan_id,
            'user_id': session['user_id'],
            'skill': selected_course['title'],
            'course_info': selected_course,
            'plan_data': plan_data,
            'created_at': datetime.now().isoformat(),
            'status': 'active',
            'start_date': start_date,
            'daily_hours': daily_hours,
            'rest_days': rest_days
        }
        
        return jsonify({
            'success': True,
            'plan_id': plan_id,
            'plan': plan_data
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'계획 생성 중 오류가 발생했습니다: {str(e)}'})

@app.route('/api/get-plan/<plan_id>')
def get_plan(plan_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
    
    if plan_id not in plans_db:
        return jsonify({'success': False, 'message': '계획을 찾을 수 없습니다.'})
    
    plan = plans_db[plan_id]
    if plan['user_id'] != session['user_id']:
        return jsonify({'success': False, 'message': '권한이 없습니다.'})
    
    return jsonify({
        'success': True,
        'plan': plan
    })

@app.route('/api/get-today-tasks/<plan_id>')
def get_today_tasks(plan_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
    
    if plan_id not in plans_db:
        return jsonify({'success': False, 'message': '계획을 찾을 수 없습니다.'})
    
    plan = plans_db[plan_id]
    today = datetime.now().strftime('%Y-%m-%d')
    
    # 오늘 할 일 찾기
    today_tasks = None
    for day_plan in plan['plan_data']['daily_plan']:
        if day_plan['date'] == today:
            today_tasks = day_plan
            break
    
    # 어제 한 일 체크
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    yesterday_progress = daily_progress_db.get(f"{session['user_id']}_{plan_id}_{yesterday}", {})
    
    return jsonify({
        'success': True,
        'today_tasks': today_tasks,
        'yesterday_progress': yesterday_progress
    })

@app.route('/api/get-review-materials', methods=['POST'])
def get_review_materials():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
    
    data = request.json
    yesterday_tasks = data.get('yesterday_tasks', [])
    
    if not yesterday_tasks:
        return jsonify({
            'success': True,
            'materials': []
        })
    
    try:
        response = openai.responses.create(
            model="gpt-4o",
            tools=[{"type": "web_search_preview"}],
            input=f"""당신은 복습 자료 추천 전문가입니다. 사용자가 어제 학습한 내용을 바탕으로 
            복습에 도움이 되는 유튜브 영상, 블로그 글, 아티클을 3개 찾아서 추천해주세요.
            
            어제 학습한 내용: {json.dumps(yesterday_tasks, ensure_ascii=False)}
            
            한국어 자료를 우선으로 해서 최신 복습 자료를 찾아주세요. 응답은 반드시 다음 JSON 형식으로 해주세요:
            {{
                "materials": [
                    {{
                        "title": "제목",
                        "type": "youtube/blog/article",
                        "url": "링크",
                        "description": "간단한 설명",
                        "duration": "예상 소요시간"
                    }}
                ]
            }}"""
        )
        
        materials_content = response.output_text
        
        try:
            # JSON 부분만 추출
            json_start = materials_content.find('{')
            json_end = materials_content.rfind('}') + 1
            if json_start != -1 and json_end != -1:
                json_str = materials_content[json_start:json_end]
                materials_data = json.loads(json_str)
            else:
                raise ValueError("JSON not found")
        except:
            materials_data = {
                "materials": [
                    {
                        "title": "어제 학습 내용 복습하기",
                        "type": "blog",
                        "url": "",
                        "description": "어제 배운 내용을 정리하고 복습해보세요",
                        "duration": "10분"
                    },
                    {
                        "title": "핵심 개념 정리",
                        "type": "article",
                        "url": "",
                        "description": "중요한 개념들을 다시 한번 점검해보세요",
                        "duration": "15분"
                    },
                    {
                        "title": "실습 예제 복습",
                        "type": "youtube",
                        "url": "",
                        "description": "실습했던 예제를 다시 따라해보세요",
                        "duration": "20분"
                    }
                ]
            }
        
        return jsonify({
            'success': True,
            'materials': materials_data['materials']
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'복습 자료 검색 중 오류가 발생했습니다: {str(e)}'})

@app.route('/api/update-progress', methods=['POST'])
def update_progress():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
    
    data = request.json
    plan_id = data.get('plan_id')
    date = data.get('date')
    task_index = data.get('task_index')
    completed = data.get('completed')
    
    progress_key = f"{session['user_id']}_{plan_id}_{date}"
    
    if progress_key not in daily_progress_db:
        daily_progress_db[progress_key] = {
            'completed_tasks': [],
            'total_tasks': 0,
            'completion_percentage': 0
        }
    
    progress = daily_progress_db[progress_key]
    
    if completed and task_index not in progress['completed_tasks']:
        progress['completed_tasks'].append(task_index)
    elif not completed and task_index in progress['completed_tasks']:
        progress['completed_tasks'].remove(task_index)
    
    # 해당 날짜의 총 태스크 수 계산
    if plan_id in plans_db:
        plan = plans_db[plan_id]
        for day_plan in plan['plan_data']['daily_plan']:
            if day_plan['date'] == date:
                progress['total_tasks'] = len(day_plan['tasks'])
                break
    
    if progress['total_tasks'] > 0:
        progress['completion_percentage'] = (len(progress['completed_tasks']) / progress['total_tasks']) * 100
    
    return jsonify({
        'success': True,
        'progress': progress
    })

@app.route('/api/recommend-next-skill', methods=['POST'])
def recommend_next_skill():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'})
    
    data = request.json
    completed_skill = data.get('completed_skill')
    user_level = data.get('user_level', 'intermediate')
    
    try:
        response = openai.responses.create(
            model="gpt-4o",
            tools=[{"type": "web_search_preview"}],
            input=f"""당신은 커리어 개발 및 스킬 로드맵 전문가입니다. 
            사용자가 완료한 스킬을 바탕으로 다음 단계로 학습하면 좋을 스킬 3개를 추천해주세요.
            
            완료한 스킬: {completed_skill}
            현재 수준: {user_level}
            
            최신 트렌드를 반영해서 한국 취업 시장에 도움이 되는 스킬들을 추천해주세요. 응답은 반드시 다음 JSON 형식으로 해주세요:
            {{
                "recommendations": [
                    {{
                        "skill": "스킬명",
                        "reason": "추천 이유",
                        "difficulty": "beginner/intermediate/advanced",
                        "connection": "이전 스킬과의 연관성",
                        "career_benefit": "커리어에 도움이 되는 점"
                    }}
                ]
            }}"""
        )
        
        recommendations_content = response.output_text
        
        try:
            # JSON 부분만 추출
            json_start = recommendations_content.find('{')
            json_end = recommendations_content.rfind('}') + 1
            if json_start != -1 and json_end != -1:
                json_str = recommendations_content[json_start:json_end]
                recommendations_data = json.loads(json_str)
            else:
                raise ValueError("JSON not found")
        except:
            recommendations_data = {
                "recommendations": [
                    {
                        "skill": f"고급 {completed_skill}",
                        "reason": "기존 스킬의 심화 학습으로 전문성을 더욱 높일 수 있습니다",
                        "difficulty": "advanced",
                        "connection": "직접적인 연관성으로 학습 곡선이 완만합니다",
                        "career_benefit": "해당 분야의 전문가로 성장할 수 있습니다"
                    },
                    {
                        "skill": f"{completed_skill} 관련 프레임워크",
                        "reason": "실무 활용도가 높은 관련 도구들을 익힐 수 있습니다",
                        "difficulty": "intermediate",
                        "connection": "기존 지식을 바탕으로 확장 학습이 가능합니다",
                        "career_benefit": "프로젝트 완성도와 개발 속도를 향상시킬 수 있습니다"
                    },
                    {
                        "skill": "프로젝트 관리",
                        "reason": "기술적 스킬과 함께 관리 역량을 기를 수 있습니다",
                        "difficulty": "intermediate",
                        "connection": "모든 기술 분야에서 필요한 공통 역량입니다",
                        "career_benefit": "리더십과 협업 능력을 기를 수 있어 승진에 도움됩니다"
                    }
                ]
            }
        
        return jsonify({
            'success': True,
            'recommendations': recommendations_data['recommendations']
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'추천 중 오류가 발생했습니다: {str(e)}'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)