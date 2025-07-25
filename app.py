from flask import Flask, request, jsonify, render_template
import openai
import json
import datetime
from typing import Dict, List, Any
import requests
import re

app = Flask(__name__, static_folder='static', template_folder='templates')

import private
openai.api_key = private.private.gpt_key

users = {}
current_user = None

class DataStore:
    def __init__(self):
        self.users = {}
        self.current_user = None
    
    def create_user(self, username, password, name, birthday):
        if username in self.users:
            return False
        self.users[username] = {
            'password': password,
            'name': name,
            'birthday': birthday,
            'plans': [],
            'current_plan': None
        }
        return True
    
    def login(self, username, password):
        if username in self.users and self.users[username]['password'] == password:
            self.current_user = username
            return True
        return False
    
    def get_current_user(self):
        if self.current_user:
            return self.users[self.current_user]
        return None

store = DataStore()

def call_gpt(prompt, use_search=False):
    try:
        if use_search:
            print(f"🔍 [INFO] 웹 검색 모드로 GPT 호출 중...")
            enhanced_prompt = f"""
🔍 **웹 검색 필수 지시사항** 🔍
- 지금 반드시 웹 검색을 사용해서 실제 데이터를 찾아야 합니다
- example.com이나 가상의 링크는 절대 사용하지 마세요
- 실제 존재하는 웹사이트에서만 정보를 가져오세요

{prompt}

⚠️ 다시 한번: 반드시 웹 검색으로 실제 존재하는 정보만 사용하세요!
"""
        else:
            print(f"📝 [INFO] 일반 모드로 GPT 호출 중...")
            enhanced_prompt = prompt
        
        response = openai.chat.completions.create(
            model="gpt-4o-search-preview",
            web_search_options={"search_context_size": "medium"},
            messages=[
                {"role": "user", "content": enhanced_prompt}
            ]
        )
        
        content = response.choices[0].message.content
        
        if use_search and 'example' in content.lower():
            print("⚠️ [WARNING] GPT 응답에 example 링크가 포함되어 있을 수 있습니다.")
        
        print(f"✅ [GPT Response Length]: {len(content)} characters")
        print(f"🔍 [GPT Response Preview]: {content[:200]}...")
        
        return content
        
    except Exception as e:
        print(f"❌ [GPT Error]: {str(e)}")
        return f"GPT 호출 중 오류가 발생했습니다: {str(e)}"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    success = store.create_user(
        data['username'], 
        data['password'], 
        data['name'], 
        data['birthday']
    )
    return jsonify({'success': success})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    success = store.login(data['username'], data['password'])
    if success:
        user = store.get_current_user()
        return jsonify({
            'success': True, 
            'user': {
                'name': user['name'],
                'plans': user['plans'],
                'current_plan': user['current_plan']
            }
        })
    return jsonify({'success': False})

@app.route('/api/generate_quiz', methods=['POST'])
def generate_quiz():
    data = request.json
    skill = data['skill']
    level = data['level']
    
    prompt = f"""
    '{skill}' 분야의 {level} 수준에 맞는 O/X 퀴즈 10개를 만들어줘.
    
    반드시 다음 JSON 형식으로 응답해줘:
    {{
        "quizzes": [
            {{
                "question": "질문 내용",
                "answer": true,
                "explanation": "정답 해설"
            }}
        ]
    }}
    
    답은 true(O) 또는 false(X)로만 표현하고, 설명은 간단명료하게 작성해줘.
    """
    
    response = call_gpt(prompt)
    
    try:
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            quiz_data = json.loads(json_match.group())
            return jsonify(quiz_data)
    except:
        pass
    
    return jsonify({
        "quizzes": [
            {
                "question": f"{skill} 관련 기본 질문입니다.",
                "answer": True,
                "explanation": "기본 설명입니다."
            }
        ]
    })

@app.route('/api/submit_answers', methods=['POST'])
def submit_answers():
    data = request.json
    answers = data['answers']
    correct_answers = data['correct_answers']
    
    score = 0
    results = []
    
    for i, (user_answer, correct_answer) in enumerate(zip(answers, correct_answers)):
        is_correct = user_answer == correct_answer['answer']
        if is_correct:
            score += 1
        results.append({
            'question_num': i + 1,
            'user_answer': user_answer,
            'correct_answer': correct_answer['answer'],
            'is_correct': is_correct,
            'explanation': correct_answer['explanation']
        })
    
    percentage = (score / len(answers)) * 100
    
    if percentage >= 80:
        assessed_level = "고급"
    elif percentage >= 60:
        assessed_level = "중급"
    else:
        assessed_level = "초급"
    
    return jsonify({
        'score': score,
        'total': len(answers),
        'percentage': percentage,
        'assessed_level': assessed_level,
        'results': results
    })

@app.route('/api/recommend_courses', methods=['POST'])
def recommend_courses():
    data = request.json
    skill = data['skill']
    level = data['assessed_level']
    
    print(f"📚 [API] 강좌 추천 요청 - 스킬: {skill}, 수준: {level}")
    
    prompt = f"""
    🚨🚨🚨 **절대 금지 사항** 🚨🚨🚨
    - example.com, example.org 등 EXAMPLE이 들어간 모든 URL 절대 사용 금지
    - 가상의 링크, 임시 링크, 테스트 링크 절대 사용 금지
    - 상상으로 만든 강좌나 책 제목 절대 사용 금지
    
    ✅ **반드시 해야 할 것** ✅
    - 지금 당장 웹 검색으로 실제 사이트에서 정보 찾기
    - 부스트코스, 유데미, 클래스101, 인프런, 유튜브 등에서 실제 온라인 강좌 검색
    - 교보문고, 예스24에서 실제 판매 중인 책 검색
    - 실제 존재하는 URL만 사용
    
    위의 것을 하지 못할 경우 실패다. 실패가 없게끔 해라.
    
    **검색할 키워드**: "{skill} 강좌" 혹은 "{skill} 책"
    **수준**: {level}
    **찾아야 하는 것** : 6개
    
    **지금 당장 다음 사이트들에서 검색해서 실제 존재하는 것만 가져와라 : 부스트코스, 유데미, 클래스101, 인프런, 유튜브, 교보문고**
    **유명한 것으로 찾을 것. 사람들한테 인기가 많아야 하며 정확하게 목차, 단원, 커리큘럼을 알 수 있는 것으로 찾아야 한다**
    **너가 찾은 것 중 3개는 반드시 온라인 강좌여야 한다. (온라인 강의 : 부스트코스, 유데미, 클래스101, 인프런, 유튜브)**
    
    **응답 형식 (부스트코스, 유데미, 클래스101, 인프런, 유튜브, 교보문고에서 찾을것 형식은 정확히 지켜라.)**
    {{
        "recommendations": [
            {{
                "title": "",
                "type": "", 
                "platform": "",
                "summary": "",
                "image_url": "",
                "link": "",
                "chapters": "",
                "duration": "",
                "price": ""
            }},
    }}
    
    **예시 (아래는 단순한 예시일 뿐이다.)**
    {{
        "recommendations": [
            {{
                "title": "놀랍다 파이썬 눈물이난다 파이썬!",
                "type": "강좌", 
                "platform": "부스트코스",
                "summary": "이 강좌는 파이썬 기초 문법부터 데이터를 다루는 법을 배운다. 이 강좌에서는 Numpy, Pandas뿐만 아니라 기초적인 scikit-learn을 이용한 머신러닝까지 다룬다.",
                "image_url": "https://www.google.com/url?sa=i&url=https%3A%2F%2Fevent.kyobobook.co.kr%2Fdetail%2F207000&psig=AOvVaw3AxX8TW4CrmKea2WSm78HS&ust=1753506877755000&source=images&cd=vfe&opi=89978449&ved=0CBUQjRxqFwoTCPjCu6ag144DFQAAAAAdAAAAABAE",
                "link": "https://www.boostcourse.org/cs122",
                "chapters": "20",
                "duration": "약 3주 과정",
                "price": "300,000원"
            }},
    }}
    
    🚨 **마지막 경고**: example이 포함된 URL이 하나라도 있으면 완전히 틀린 답변이다. 반드시 실제 웹사이트에서 검색해서 실제 존재하는 강좌와 책만 찾아라!!!!!!!!!!!!!!!!!!!!1
    """
    
    response = call_gpt(prompt, use_search=True)
    
    try:
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            recommendations_data = json.loads(json_match.group())
            
            has_example = False
            for rec in recommendations_data.get('recommendations', []):
                link = rec.get('link', '').lower()
                if 'example' in link:
                    print(f"🚨 [CRITICAL ERROR] Example 링크 발견: {rec.get('title')} -> {rec.get('link')}")
                    has_example = True
            
            if has_example:
                print("🚨 GPT가 여전히 example 링크를 사용했습니다. 기본 추천으로 대체합니다.")
                raise ValueError("Example 링크 사용으로 인한 실패")
            
            print("✅ 모든 링크가 실제 사이트입니다.")
            return jsonify(recommendations_data)
            
    except Exception as e:
        print(f"🚨 [GPT Parse Error]: {e}")
        print(f"🚨 원본 GPT 응답: {response[:500]}...")
    
    print(f"🔄 기본 추천 사용: {skill} 관련 일반적인 추천")
    return jsonify({
        "recommendations": [
            {
                "title": f"{skill} 온라인 강의 찾기",
                "type": "강좌",
                "platform": "인프런",
                "summary": f"{skill} 관련 강의를 인프런에서 검색해보세요.",
                "image_url": "https://via.placeholder.com/300x200?text=Inflearn",
                "link": f"https://inflearn.com/courses?s={skill}",
                "chapters": 10,
                "duration": "4주",
                "price": "검색 후 확인"
            },
            {
                "title": f"{skill} 전문 강좌",
                "type": "강좌",
                "platform": "유데미",
                "summary": f"{skill} 전문 강좌를 유데미에서 확인해보세요.",
                "image_url": "https://via.placeholder.com/300x200?text=Udemy",
                "link": f"https://udemy.com/courses/search/?q={skill}",
                "chapters": 15,
                "duration": "6주",
                "price": "검색 후 확인"
            },
            {
                "title": f"{skill} 관련 도서",
                "type": "책", 
                "platform": "교보문고",
                "summary": f"{skill} 학습 도서를 교보문고에서 찾아보세요.",
                "image_url": "https://via.placeholder.com/300x200?text=Kyobo",
                "link": f"https://kyobobook.co.kr/search/SearchCommonMain.jsp?vPstrKeyWord={skill}",
                "chapters": 15,
                "duration": "6주",
                "price": "검색 후 확인"
            },
            {
                "title": f"{skill} 전문서적",
                "type": "책",
                "platform": "예스24", 
                "summary": f"{skill} 전문 서적을 예스24에서 찾아보세요.",
                "image_url": "https://via.placeholder.com/300x200?text=Yes24",
                "link": f"https://yes24.com/Product/Search?domain=ALL&query={skill}",
                "chapters": 20,
                "duration": "8주",
                "price": "검색 후 확인"
            }
        ]
    })

@app.route('/api/generate_plan', methods=['POST'])
def generate_plan():
    data = request.json
    
    prompt = f"""
    다음 정보를 바탕으로 상세한 학습 계획을 만들어줘:
    
    - 선택한 강좌: {data['selected_course']['title']}
    - 총 챕터 수: {data['selected_course']['chapters']}
    - 하루 공부 시간: {data['study_hours']}시간
    - 시작 날짜: {data['start_date']}
    - 공부 안하는 요일: {data['rest_days']}
    - 사용자 수준: {data['user_level']}
    
    각 날짜별로 구체적인 학습 내용을 배정해줘. 
    
    반드시 다음 JSON 형식으로 응답해줘:
    {{
        "plan_name": "계획 이름",
        "total_duration": "총 기간",
        "daily_schedule": [
            {{
                "date": "YYYY-MM-DD",
                "tasks": [
                    {{
                        "title": "학습 내용 제목",
                        "description": "상세 설명",
                        "duration": "예상 소요시간",
                        "link": "관련 링크",
                        "completed": false
                    }}
                ]
            }}
        ]
    }}
    
    실제 달력 날짜를 계산해서 {data['start_date']}부터 시작하여 순차적으로 배정해줘.
    실습같은 요소도 넣어줘야해. 블로그를 통해서 개념 체화라던지, 아니면 깃헙을 찾아서 관련 코드를 리뷰해본다던지 말야. 
    공부 안하는 요일({data['rest_days']})은 제외하고 계획해줘.
    """
    
    response = call_gpt(prompt)
    
    try:
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            plan_data = json.loads(json_match.group())
            
            user = store.get_current_user()
            if user:
                user['plans'].append(plan_data)
                user['current_plan'] = len(user['plans']) - 1
            
            return jsonify(plan_data)
    except Exception as e:
        print(f"Plan generation error: {e}")
    
    return jsonify({
        "plan_name": f"{data.get('skill', 'Unknown')} 학습 계획",
        "total_duration": "4주",
        "daily_schedule": []
    })

@app.route('/api/update_task', methods=['POST'])
def update_task():
    data = request.json
    date = data['date']
    task_index = data['task_index']
    completed = data['completed']
    
    user = store.get_current_user()
    if user and user['current_plan'] is not None:
        plan = user['plans'][user['current_plan']]
        
        for day in plan['daily_schedule']:
            if day['date'] == date:
                if 0 <= task_index < len(day['tasks']):
                    day['tasks'][task_index]['completed'] = completed
                    
                    total_tasks = len(day['tasks'])
                    completed_tasks = sum(1 for task in day['tasks'] if task['completed'])
                    progress = (completed_tasks / total_tasks) * 100 if total_tasks > 0 else 0
                    
                    return jsonify({
                        'success': True,
                        'progress': progress,
                        'completed_tasks': completed_tasks,
                        'total_tasks': total_tasks
                    })
    
    return jsonify({'success': False})

@app.route('/api/get_today_tasks', methods=['GET'])
def get_today_tasks():
    today = datetime.date.today().strftime('%Y-%m-%d')
    
    user = store.get_current_user()
    if user and user['current_plan'] is not None:
        plan = user['plans'][user['current_plan']]
        
        for day in plan['daily_schedule']:
            if day['date'] == today:
                return jsonify({
                    'success': True,
                    'date': today,
                    'tasks': day['tasks']
                })
    
    return jsonify({'success': False, 'tasks': []})

@app.route('/api/get_review_materials', methods=['POST'])
def get_review_materials():
    data = request.json
    completed_topics = data.get('completed_topics', [])
    
    if not completed_topics:
        print("📝 [API] 복습 자료 요청 - 완료된 주제 없음")
        return jsonify({'materials': []})
    
    topics_str = ', '.join(completed_topics)
    print(f"📚 [API] 복습 자료 요청 - 주제: {topics_str}")
    
    prompt = f"""
    🚨🚨🚨 **절대 금지 사항** 🚨🚨🚨
    - example.com, example.org 등 EXAMPLE이 들어간 모든 URL 절대 사용 금지
    - 가상의 링크, 임시 링크, 테스트 링크 절대 사용 금지
    - 상상으로 만든 블로그나 영상 제목 절대 사용 금지
    
    ✅ **반드시 해야 할 것** ✅
    - 지금 당장 웹 검색으로 실제 사이트에서 복습 자료 찾기
    - 네이버 블로그, 티스토리, 브런치에서 실제 포스팅 검색
    - 유튜브에서 실제 영상 검색
    - 깃허브에서 실제 실습 자료 검색
    - 실제 존재하는 URL만 사용
    
    **검색할 주제**: {topics_str}
    
    **지금 당장 다음 사이트들에서 검색해서 실제 존재하는 것만 가져와라:**
    **구글에 검색해서 나오는 것이라도 좋다**
    1. 유튜브 (youtube.com) - {topics_str} 관련 영상
    2. 네이버 블로그 (blog.naver.com) - {topics_str} 관련 포스팅
    3. 티스토리 (tistory.com) - {topics_str} 관련 블로그
    4. 깃허브 (github.com) - {topics_str} 관련 실습 자료
    5. 벨로그 (velog.io) - {topics_str} 관련 개발 블로그
    
    **응답 형식 (실제 검색 결과로만 채워라 - 총 4개):**
    {{
        "materials": [
            {{
                "title": "유튜브에서 실제로 찾은 영상 제목",
                "type": "유튜브",
                "url": "https://youtube.com/watch?v=실제-영상-링크",
                "description": "실제 영상 설명"
            }},
            {{
                "title": "네이버 블로그에서 실제로 찾은 포스팅 제목",
                "type": "블로그", 
                "url": "https://blog.naver.com/실제-블로그-링크",
                "description": "실제 포스팅 설명"
            }},
            {{
                "title": "티스토리에서 실제로 찾은 블로그 제목",
                "type": "블로그",
                "url": "https://실제블로그.tistory.com/실제-포스팅-링크",
                "description": "실제 블로그 설명"
            }},
            {{
                "title": "깃허브에서 실제로 찾은 실습 자료 제목",
                "type": "실습",
                "url": "https://github.com/실제-레포지토리-링크",
                "description": "실제 실습 자료 설명"
            }},
            {{
                "title": "벨로그에서 실제로 찾은 개발 블로그 제목",
                "type": "블로그",
                "url": "https://velog.io/@실제-유저/실제-포스팅-링크",
                "description": "실제 개발 블로그 설명"
            }}
        ]
    }}
    
    🚨 **마지막 경고**: example이 포함된 URL이 하나라도 있으면 완전히 틀린 답변이다. 반드시 실제 웹사이트에서 검색해서 실제 존재하는 자료만 찾아라! 총 5개를 모두 채워라!
    """
    
    response = call_gpt(prompt, use_search=True)
    
    try:
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            materials_data = json.loads(json_match.group())
            
            has_example = False
            for material in materials_data.get('materials', []):
                url = material.get('url', '').lower()
                if 'example' in url:
                    print(f"🚨 [CRITICAL ERROR] Example 링크 발견: {material.get('title')} -> {material.get('url')}")
                    has_example = True
            
            if has_example:
                print("🚨 GPT가 여전히 example 링크를 사용했습니다. 기본 추천으로 대체합니다.")
                raise ValueError("Example 링크 사용으로 인한 실패")
            
            print("✅ 모든 링크가 실제 사이트입니다.")
            return jsonify(materials_data)
            
    except Exception as e:
        print(f"🚨 [GPT Parse Error]: {e}")
        print(f"🚨 원본 GPT 응답: {response[:500]}...")
    
    print(f"🔄 기본 복습 자료 사용: {topics_str} 관련 검색 링크")
    search_query = topics_str.replace(' ', '%20').replace(',', '')
    return jsonify({
        'materials': [
            {
                "title": f"{topics_str} 학습 영상 검색",
                "type": "유튜브",
                "url": f"https://youtube.com/results?search_query={search_query}",
                "description": "유튜브에서 관련 학습 영상을 검색해보세요."
            },
            {
                "title": f"{topics_str} 블로그 포스팅 검색",
                "type": "블로그",
                "url": f"https://search.naver.com/search.naver?where=post&query={search_query}",
                "description": "네이버에서 관련 블로그 포스팅을 검색해보세요."
            },
            {
                "title": f"{topics_str} 티스토리 검색",
                "type": "블로그",
                "url": f"https://www.google.com/search?q=site:tistory.com+{search_query}",
                "description": "티스토리에서 관련 블로그를 검색해보세요."
            },
            {
                "title": f"{topics_str} 실습 자료 검색",
                "type": "실습",
                "url": f"https://github.com/search?q={search_query}",
                "description": "깃허브에서 관련 실습 자료를 검색해보세요."
            },
            {
                "title": f"{topics_str} 벨로그 검색",
                "type": "블로그",
                "url": f"https://velog.io/search?q={search_query}",
                "description": "벨로그에서 관련 개발 블로그를 검색해보세요."
            }
        ]
    })

@app.route('/api/recommend_next_skills', methods=['POST'])
def recommend_next_skills():
    data = request.json
    completed_skill = data['completed_skill']
    
    prompt = f"""
    '{completed_skill}' 스킬을 완료한 학습자에게 연관성이 높은 다음 스킬 3가지를 추천해줘.
    
    반드시 다음 JSON 형식으로 응답해줘:
    {{
        "next_skills": [
            {{
                "skill": "스킬명",
                "reason": "추천 이유",
                "difficulty": "초급|중급|고급"
            }}
        ]
    }}
    """
    
    response = call_gpt(prompt)
    
    try:
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            skills = json.loads(json_match.group())
            return jsonify(skills)
    except:
        pass
    
    return jsonify({
        'next_skills': [
            {
                'skill': '관련 스킬',
                'reason': '연관성이 높습니다',
                'difficulty': '중급'
            }
        ]
    })

if __name__ == '__main__':
    app.run(debug=True)