// 전역 변수
let currentUser = null;
let currentQuiz = null;
let currentQuizIndex = 0;
let quizAnswers = [];
let selectedCourse = null;
let currentPlan = null;
let currentPlanId = null;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 바로 로그인 화면 표시
    showScreen('login-screen');
    
    // 오늘 날짜를 시작 날짜 기본값으로 설정
    const today = new Date().toISOString().split('T')[0];
    const startDateInput = document.getElementById('start-date');
    if (startDateInput) {
        startDateInput.value = today;
    }
});

// 화면 전환 함수
function showScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

// 토스트 메시지 표시
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// 탭 전환 (로그인/회원가입)
function showTab(tabName) {
    const tabs = document.querySelectorAll('.tab-button');
    const forms = document.querySelectorAll('.auth-form');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    forms.forEach(form => form.classList.remove('active'));
    
    document.querySelector(`.tab-button:nth-child(${tabName === 'login' ? '1' : '2'})`).classList.add('active');
    document.getElementById(`${tabName}-form`).classList.add('active');
}

// 회원가입
async function register() {
    const name = document.getElementById('register-name').value;
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const birthday = document.getElementById('register-birthday').value;
    
    if (!name || !username || !password || !birthday) {
        showToast('모든 필드를 입력해주세요.');
        return;
    }
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                username: username,
                password: password,
                birthday: birthday
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('회원가입이 완료되었습니다!');
            await loadUserInfo();
            showHome();
        } else {
            showToast(result.message);
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('회원가입 중 오류가 발생했습니다.');
    }
}

// 로그인
async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        showToast('사용자명과 비밀번호를 입력해주세요.');
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('로그인 성공!');
            await loadUserInfo();
            showHome();
        } else {
            showToast(result.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('로그인 중 오류가 발생했습니다.');
    }
}

// 로그아웃
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        showScreen('login-screen');
        showToast('로그아웃되었습니다.');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// 사용자 정보 로드
async function loadUserInfo() {
    try {
        const response = await fetch('/api/user-info');
        const result = await response.json();
        
        if (result.success) {
            currentUser = result.user;
            displayUserPlans(result.plans);
        }
    } catch (error) {
        console.error('Load user info error:', error);
    }
}

// 홈 화면 표시
function showHome() {
    showScreen('home-screen');
    if (currentUser) {
        document.getElementById('welcome-message').textContent = 
            `안녕하세요, ${currentUser.name}님! 오늘도 열심히 공부해봐요 🚀`;
    }
    loadUserInfo();
}

// 사용자 계획 표시
function displayUserPlans(plans) {
    const container = document.getElementById('plans-container');
    
    if (!plans || plans.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>📚 아직 학습 계획이 없어요</h3>
                <p>새로운 스킬을 배워보세요!</p>
                <button class="btn-primary" onclick="showCreatePlan()">첫 계획 만들기</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = plans.map(plan => {
        const progress = calculatePlanProgress(plan);
        const statusClass = plan.status === 'completed' ? 'completed' : 
                          plan.status === 'overdue' ? 'overdue' : 'active';
        
        return `
            <div class="plan-card" onclick="openPlan('${plan.id}')">
                <h3>${plan.skill}</h3>
                <p>${plan.course_info?.description || '학습 계획'}</p>
                <div class="plan-progress">
                    <div class="plan-progress-fill" style="width: ${progress}%"></div>
                </div>
                <p class="plan-status ${statusClass}">${progress}% 완료 • ${statusClass === 'active' ? '진행중' : statusClass === 'completed' ? '완료' : '지연'}</p>
            </div>
        `;
    }).join('');
}

// 계획 진행률 계산
function calculatePlanProgress(plan) {
    // 실제 구현에서는 일일 진행상황을 기반으로 계산
    return Math.floor(Math.random() * 100); // 임시 값
}

// 마이페이지 표시
function showMyPage() {
    showScreen('mypage-screen');
    
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.name;
        document.getElementById('user-birthday').textContent = currentUser.birthday;
        
        // 계획 요약 표시
        loadUserInfo().then(() => {
            // 추가 마이페이지 로직
        });
    }
}

// 계획 생성 화면 표시
function showCreatePlan() {
    showScreen('create-plan-screen');
    showStep(1);
}

// 스텝 표시
function showStep(stepNumber) {
    // 스텝 인디케이터 업데이트
    const steps = document.querySelectorAll('.step');
    steps.forEach((step, index) => {
        if (index + 1 <= stepNumber) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
    
    // 스텝 콘텐츠 표시
    const stepContents = document.querySelectorAll('.step-content');
    stepContents.forEach((content, index) => {
        if (index + 1 === stepNumber) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
}

// 다음 스텝
async function nextStep(stepNumber) {
    if (stepNumber === 2) {
        // 퀴즈 생성
        await generateQuiz();
    }
    showStep(stepNumber);
}

// 이전 스텝
function prevStep(stepNumber) {
    showStep(stepNumber);
}

// 퀴즈 생성
async function generateQuiz() {
    const skill = document.getElementById('skill-name').value;
    const knowledgeLevel = document.getElementById('knowledge-level').value;
    
    if (!skill) {
        showToast('스킬명을 입력해주세요.');
        return;
    }
    
    try {
        showToast('퀴즈를 생성하고 있습니다...', 5000);
        
        const response = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                skill: skill,
                knowledge_level: knowledgeLevel
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentQuiz = result.quiz;
            displayQuiz();
        } else {
            showToast(result.message);
        }
    } catch (error) {
        console.error('Quiz generation error:', error);
        showToast('퀴즈 생성 중 오류가 발생했습니다.');
    }
}

// 퀴즈 표시
function displayQuiz() {
    const container = document.getElementById('quiz-questions');
    
    if (!currentQuiz || !currentQuiz.questions) {
        container.innerHTML = '<p>퀴즈를 불러올 수 없습니다.</p>';
        return;
    }
    
    container.innerHTML = currentQuiz.questions.map((q, index) => `
        <div class="quiz-question ${index === 0 ? 'active' : ''}" data-question-id="${index}">
            <div class="quiz-progress">문제 ${index + 1} / ${currentQuiz.questions.length}</div>
            <h4>${q.question}</h4>
            <div class="quiz-options">
                <button class="quiz-option" onclick="selectQuizAnswer(${index}, true)">O (맞음)</button>
                <button class="quiz-option" onclick="selectQuizAnswer(${index}, false)">X (틀림)</button>
            </div>
        </div>
    `).join('');
    
    // 퀴즈 네비게이션 표시
    document.querySelector('.quiz-navigation').style.display = 'flex';
    
    currentQuizIndex = 0;
    quizAnswers = [];
}

// 퀴즈 답변 선택
function selectQuizAnswer(questionIndex, answer) {
    const questionDiv = document.querySelector(`[data-question-id="${questionIndex}"]`);
    const options = questionDiv.querySelectorAll('.quiz-option');
    
    // 기존 선택 제거
    options.forEach(option => option.classList.remove('selected'));
    
    // 새 선택 표시
    const selectedOption = answer ? options[0] : options[1];
    selectedOption.classList.add('selected');
    
    // 답변 저장
    quizAnswers[questionIndex] = answer;
    
    // 자동으로 다음 문제로 이동 (1초 후)
    setTimeout(() => {
        if (questionIndex < currentQuiz.questions.length - 1) {
            showQuizQuestion(questionIndex + 1);
        }
    }, 1000);
}

// 퀴즈 문제 표시
function showQuizQuestion(index) {
    const questions = document.querySelectorAll('.quiz-question');
    questions.forEach((q, i) => {
        if (i === index) {
            q.classList.add('active');
        } else {
            q.classList.remove('active');
        }
    });
    currentQuizIndex = index;
}

// 퀴즈 제출
async function submitQuiz() {
    if (quizAnswers.length !== currentQuiz.questions.length) {
        showToast('모든 문제에 답해주세요.');
        return;
    }
    
    // 정답 개수 계산
    let correctCount = 0;
    currentQuiz.questions.forEach((q, index) => {
        if (quizAnswers[index] === q.answer) {
            correctCount++;
        }
    });
    
    try {
        showToast('결과를 분석하고 강좌를 추천하고 있습니다...', 10000);
        
        const response = await fetch('/api/analyze-quiz-result', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                skill: document.getElementById('skill-name').value,
                answers: quizAnswers,
                correct_count: correctCount
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayCourseRecommendations(result.analysis);
            nextStep(3);
        } else {
            showToast(result.message);
        }
    } catch (error) {
        console.error('Quiz analysis error:', error);
        showToast('분석 중 오류가 발생했습니다.');
    }
}

// 강좌 추천 표시
function displayCourseRecommendations(analysis) {
    const container = document.getElementById('recommended-courses');
    
    if (!analysis.recommendations) {
        container.innerHTML = '<p>추천 강좌를 불러올 수 없습니다.</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="analysis-result">
            <p><strong>수준 분석:</strong> ${analysis.level_analysis}</p>
        </div>
        ${analysis.recommendations.map((course, index) => `
            <div class="course-card" onclick="selectCourse(${index})" data-course-index="${index}">
                <h4>${course.title}</h4>
                <p>${course.description}</p>
                <div class="course-meta">
                    <span class="course-difficulty">${course.difficulty}</span>
                    <span class="course-duration">${course.duration}</span>
                </div>
                ${course.url ? `<p><a href="${course.url}" target="_blank">강좌 링크 보기</a></p>` : ''}
            </div>
        `).join('')}
    `;
    
    // 추천 데이터 저장
    window.currentRecommendations = analysis.recommendations;
}

// 강좌 선택
function selectCourse(index) {
    const cards = document.querySelectorAll('.course-card');
    cards.forEach(card => card.classList.remove('selected'));
    
    const selectedCard = document.querySelector(`[data-course-index="${index}"]`);
    selectedCard.classList.add('selected');
    
    selectedCourse = window.currentRecommendations[index];
    
    // 계획 생성 진행
    setTimeout(() => {
        createStudyPlan();
    }, 1000);
}

// 학습 계획 생성
async function createStudyPlan() {
    if (!selectedCourse) {
        showToast('강좌를 선택해주세요.');
        return;
    }
    
    const dailyHours = parseInt(document.getElementById('daily-hours').value);
    const startDate = document.getElementById('start-date').value;
    const restDays = [];
    
    // 휴식일 수집
    document.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
        restDays.push(checkbox.value);
    });
    
    try {
        showToast('맞춤형 학습 계획을 생성하고 있습니다...', 10000);
        
        const response = await fetch('/api/create-study-plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                selected_course: selectedCourse,
                daily_hours: dailyHours,
                rest_days: restDays,
                start_date: startDate
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentPlan = result.plan;
            currentPlanId = result.plan_id;
            displayPlanPreview(result.plan);
            nextStep(4);
        } else {
            showToast(result.message);
        }
    } catch (error) {
        console.error('Plan creation error:', error);
        showToast('계획 생성 중 오류가 발생했습니다.');
    }
}

// 계획 미리보기 표시
function displayPlanPreview(plan) {
    const container = document.getElementById('calendar-container');
    
    if (!plan.daily_plan) {
        container.innerHTML = '<p>계획을 불러올 수 없습니다.</p>';
        return;
    }
    
    // 간단한 캘린더 형태로 표시
    const calendarHTML = `
        <div class="plan-summary">
            <h4>📅 총 예상 기간: ${plan.total_duration}</h4>
            <p>총 ${plan.daily_plan.length}일 학습 계획</p>
        </div>
        <div class="plan-preview-list">
            ${plan.daily_plan.slice(0, 7).map(day => `
                <div class="preview-day">
                    <strong>Day ${day.day} (${day.date})</strong>
                    <ul>
                        ${day.tasks.map(task => `
                            <li>${task.task} (${task.duration})</li>
                        `).join('')}
                    </ul>
                </div>
            `).join('')}
            ${plan.daily_plan.length > 7 ? '<p>... 그리고 더 많은 계획들</p>' : ''}
        </div>
    `;
    
    container.innerHTML = calendarHTML;
}

// 계획 확정
function confirmPlan() {
    showToast('학습 계획이 생성되었습니다! 🎉');
    showHome();
}

// 계획 열기
async function openPlan(planId) {
    currentPlanId = planId;
    
    try {
        const response = await fetch(`/api/get-plan/${planId}`);
        const result = await response.json();
        
        if (result.success) {
            currentPlan = result.plan;
            document.getElementById('plan-title').textContent = `📚 ${result.plan.skill}`;
            
            // 오늘 할 일과 어제 진행상황 로드
            await loadTodayTasks(planId);
            showScreen('plan-detail-screen');
        } else {
            showToast(result.message);
        }
    } catch (error) {
        console.error('Plan loading error:', error);
        showToast('계획을 불러오는 중 오류가 발생했습니다.');
    }
}

// 오늘 할 일 로드
async function loadTodayTasks(planId) {
    try {
        const response = await fetch(`/api/get-today-tasks/${planId}`);
        const result = await response.json();
        
        if (result.success) {
            // 어제 진행상황이 있으면 복습 자료 표시
            if (result.yesterday_progress && Object.keys(result.yesterday_progress).length > 0) {
                await loadReviewMaterials(result.yesterday_progress);
            } else {
                document.getElementById('review-section').style.display = 'none';
                startTodayStudy();
            }
            
            displayTodayTasks(result.today_tasks);
        }
    } catch (error) {
        console.error('Today tasks loading error:', error);
    }
}

// 복습 자료 로드
async function loadReviewMaterials(yesterdayProgress) {
    try {
        const response = await fetch('/api/get-review-materials', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                yesterday_tasks: yesterdayProgress.completed_tasks || []
            })
        });
        
        const result = await response.json();
        
        if (result.success && result.materials.length > 0) {
            displayReviewMaterials(result.materials);
            document.getElementById('review-section').style.display = 'block';
        } else {
            document.getElementById('review-section').style.display = 'none';
            startTodayStudy();
        }
    } catch (error) {
        console.error('Review materials loading error:', error);
        document.getElementById('review-section').style.display = 'none';
        startTodayStudy();
    }
}

// 복습 자료 표시
function displayReviewMaterials(materials) {
    const container = document.getElementById('review-materials');
    
    container.innerHTML = materials.map(material => `
        <div class="review-item">
            <h4>${material.title}</h4>
            <p>${material.description}</p>
            <p><strong>타입:</strong> ${material.type} | <strong>예상 시간:</strong> ${material.duration}</p>
            ${material.url ? `<a href="${material.url}" target="_blank">자료 보기 →</a>` : ''}
        </div>
    `).join('');
}

// 오늘 학습 시작
function startTodayStudy() {
    document.getElementById('review-section').style.display = 'none';
    document.getElementById('today-study-section').style.display = 'block';
}

// 오늘 할 일 표시
function displayTodayTasks(todayTasks) {
    const container = document.getElementById('today-tasks');
    
    if (!todayTasks || !todayTasks.tasks) {
        container.innerHTML = '<p>오늘은 휴식일입니다! 🌟</p>';
        return;
    }
    
    container.innerHTML = todayTasks.tasks.map((task, index) => `
        <div class="task-item" data-task-index="${index}">
            <div class="task-info">
                <h4>${task.task}</h4>
                <p><strong>예상 시간:</strong> ${task.duration}</p>
                <p><strong>타입:</strong> ${task.type}</p>
                ${task.url ? `<a href="${task.url}" target="_blank">자료 링크 →</a>` : ''}
            </div>
            <input type="checkbox" class="task-checkbox" 
                   onchange="updateTaskProgress(${index}, this.checked)" 
                   data-task-index="${index}">
        </div>
    `).join('');
    
    updateProgressBar();
}

// 진행률 업데이트
async function updateTaskProgress(taskIndex, completed) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const response = await fetch('/api/update-progress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                plan_id: currentPlanId,
                date: today,
                task_index: taskIndex,
                completed: completed
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateProgressBar();
            
            // 모든 태스크 완료 시 축하 화면
            if (result.progress.completion_percentage === 100) {
                showCompletionCelebration();
            }
        }
    } catch (error) {
        console.error('Progress update error:', error);
    }
}

// 진행률 바 업데이트
function updateProgressBar() {
    const checkboxes = document.querySelectorAll('.task-checkbox');
    const checkedBoxes = document.querySelectorAll('.task-checkbox:checked');
    
    if (checkboxes.length === 0) return;
    
    const progress = (checkedBoxes.length / checkboxes.length) * 100;
    
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('progress-text').textContent = `${Math.round(progress)}%`;
    
    // 완료된 태스크 스타일 업데이트
    checkboxes.forEach((checkbox, index) => {
        const taskItem = checkbox.closest('.task-item');
        if (checkbox.checked) {
            taskItem.classList.add('completed');
        } else {
            taskItem.classList.remove('completed');
        }
    });
}

// 완료 축하 화면
function showCompletionCelebration() {
    document.getElementById('completion-celebration').style.display = 'block';
    showToast('🎉 오늘 학습 완료! 정말 멋져요!');
    
    // 3초 후 숨기기
    setTimeout(() => {
        document.getElementById('completion-celebration').style.display = 'none';
    }, 5000);
}

// 다음 스킬 추천 (계획 완료 시)
async function recommendNextSkill(completedSkill) {
    try {
        const response = await fetch('/api/recommend-next-skill', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                completed_skill: completedSkill,
                user_level: 'intermediate'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayNextSkillRecommendations(result.recommendations);
            showScreen('next-skill-screen');
        }
    } catch (error) {
        console.error('Next skill recommendation error:', error);
    }
}

// 다음 스킬 추천 표시
function displayNextSkillRecommendations(recommendations) {
    document.getElementById('completed-skill-name').textContent = currentPlan.skill;
    document.getElementById('completion-date').textContent = new Date().toLocaleDateString();
    
    const container = document.getElementById('next-skill-options');
    
    container.innerHTML = recommendations.map((rec, index) => `
        <div class="recommendation-card" onclick="selectNextSkill(${index})" data-rec-index="${index}">
            <h4>${rec.skill}</h4>
            <p><strong>추천 이유:</strong> ${rec.reason}</p>
            <p><strong>연관성:</strong> ${rec.connection}</p>
            <p><strong>커리어 도움:</strong> ${rec.career_benefit}</p>
            <div class="recommendation-meta">
                <span class="course-difficulty">${rec.difficulty}</span>
            </div>
        </div>
    `).join('');
    
    window.nextSkillRecommendations = recommendations;
}

// 다음 스킬 선택
function selectNextSkill(index) {
    const cards = document.querySelectorAll('.recommendation-card');
    cards.forEach(card => card.classList.remove('selected'));
    
    const selectedCard = document.querySelector(`[data-rec-index="${index}"]`);
    selectedCard.classList.add('selected');
    
    const selectedSkill = window.nextSkillRecommendations[index];
    
    // 선택된 스킬로 새 계획 생성 과정 시작
    setTimeout(() => {
        startNewPlanWithSelectedSkill(selectedSkill.skill);
    }, 1000);
}

// 선택된 스킬로 새 계획 시작
function startNewPlanWithSelectedSkill(skillName) {
    showCreatePlan();
    
    // 스킬 이름 미리 입력
    document.getElementById('skill-name').value = skillName;
    
    showToast('새로운 학습 계획을 시작해보세요!');
}

// 추천 건너뛰기
function skipRecommendation() {
    showHome();
    showToast('언제든 새로운 계획을 만들 수 있어요!');
}

// 유틸리티 함수들
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
}

function getDayName(dateString) {
    const date = new Date(dateString);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[date.getDay()];
}

// 에러 핸들링
window.addEventListener('error', function(e) {
    console.error('JavaScript error:', e.error);
    showToast('오류가 발생했습니다. 페이지를 새로고침해보세요.');
});

// 네트워크 에러 핸들링
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    showToast('네트워크 오류가 발생했습니다.');
});