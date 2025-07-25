let currentUser = null;
let currentQuizzes = [];
let currentQuizIndex = 0;
let userAnswers = [];
let selectedCourse = null;
let currentPlan = null;
let currentDate = new Date();
let currentMonth = new Date();
let devCurrentDate = new Date();
let isPlanConfirmed = false;
let pendingDateChange = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('Palearn 초기화 완료');
    updateTodayDate();
    renderCalendar();
    initDevControls();
});

async function apiCall(endpoint, data = null, method = 'GET', showLoadingScreen = true) {
    if (showLoadingScreen) {
        showLoading();
    }
    
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`/api${endpoint}`, options);
        const result = await response.json();
        
        console.log(`API Call [${method} ${endpoint}]:`, result);
        return result;
        
    } catch (error) {
        console.error(`API Error [${endpoint}]:`, error);
        if (showLoadingScreen) {
            alert('서버와의 통신 중 오류가 발생했습니다.');
        }
        return null;
    } finally {
        if (showLoadingScreen) {
            hideLoading();
        }
    }
}

function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    
    if (tab === 'login') {
        document.querySelector('.tab-btn').classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('registerForm').classList.add('active');
    }
}

async function register() {
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const name = document.getElementById('regName').value;
    const birthday = document.getElementById('regBirthday').value;
    
    if (!username || !password || !name || !birthday) {
        alert('모든 필드를 입력해주세요.');
        return;
    }
    
    const result = await apiCall('/register', {
        username, password, name, birthday
    }, 'POST');
    
    if (result && result.success) {
        alert('회원가입이 완료되었습니다. 로그인해주세요.');
        switchTab('login');
    } else {
        alert('이미 존재하는 사용자명입니다.');
    }
}

async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        alert('사용자명과 비밀번호를 입력해주세요.');
        return;
    }
    
    const result = await apiCall('/login', {
        username, password
    }, 'POST');
    
    if (result && result.success) {
        currentUser = result.user;
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('homeUserName').textContent = currentUser.name;
        document.getElementById('userInfo').style.display = 'block';
        
        showHome();
        loadUserPlans();
    } else {
        alert('로그인 정보가 올바르지 않습니다.');
    }
}

function logout() {
    currentUser = null;
    currentPlan = null;
    isPlanConfirmed = false;
    pendingDateChange = null;
    document.getElementById('userInfo').style.display = 'none';
    showSection('loginSection');
}

function showHome() {
    currentPlan = null;
    isPlanConfirmed = false;
    showSection('homeSection');
    loadUserPlans();
}

function loadUserPlans() {
    const plansList = document.getElementById('plansList');
    
    if (!currentUser || !currentUser.plans || currentUser.plans.length === 0) {
        plansList.innerHTML = '<p>아직 학습 계획이 없습니다. 새로운 계획을 만들어보세요!</p>';
        return;
    }
    
    plansList.innerHTML = '';
    currentUser.plans.forEach((plan, index) => {
        const progress = calculatePlanProgress(plan);
        const planItem = document.createElement('div');
        planItem.className = 'plan-item';
        
        planItem.innerHTML = `
            <div class="plan-content" onclick="openPlan(${index})">
                <h4>${plan.plan_name}</h4>
                <p>총 기간: ${plan.total_duration}</p>
                <div class="plan-progress">
                    <div class="progress-bar" style="width: ${progress}%"></div>
                </div>
                <p>진행률: ${progress}%</p>
            </div>
            <div class="plan-actions">
                <button onclick="editPlanName(${index})" class="btn-edit">이름 수정</button>
                <button onclick="deletePlan(${index})" class="btn-delete">삭제</button>
            </div>
        `;
        
        plansList.appendChild(planItem);
    });
}

function calculatePlanProgress(plan) {
    if (!plan.daily_schedule || plan.daily_schedule.length === 0) return 0;
    
    let totalTasks = 0;
    let completedTasks = 0;
    
    plan.daily_schedule.forEach(day => {
        totalTasks += day.tasks.length;
        completedTasks += day.tasks.filter(task => task.completed).length;
    });
    
    return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
}

function openPlan(planIndex) {
    currentPlan = currentUser.plans[planIndex];
    isPlanConfirmed = true;
    
    showSection('calendarSection');
    
    const confirmBtn = document.getElementById('confirmPlanBtn');
    if (confirmBtn) {
        confirmBtn.style.display = 'none';
    }
    
    renderCalendar();
    loadTodayTasks();
    loadReviewMaterials();
}

function editPlanName(planIndex) {
    const newName = prompt('새로운 계획명을 입력하세요:', currentUser.plans[planIndex].plan_name);
    if (newName && newName.trim()) {
        currentUser.plans[planIndex].plan_name = newName.trim();
        loadUserPlans();
    }
}

function deletePlan(planIndex) {
    if (confirm('정말로 이 계획을 삭제하시겠습니까?')) {
        currentUser.plans.splice(planIndex, 1);
        
        if (currentUser.current_plan === planIndex) {
            currentUser.current_plan = null;
            currentPlan = null;
            isPlanConfirmed = false;
        } else if (currentUser.current_plan > planIndex) {
            currentUser.current_plan--;
        }
        
        loadUserPlans();
    }
}

function showCreatePlan() {
    showSection('createPlanSection');
    
    const today = getCurrentDate();
    document.getElementById('startDate').value = today;
}

async function startQuiz() {
    const skill = document.getElementById('skillInput').value;
    const selfLevel = document.getElementById('selfLevel').value;
    
    if (!skill) {
        alert('배우고 싶은 스킬을 입력해주세요.');
        return;
    }
    
    const result = await apiCall('/generate_quiz', {
        skill, level: selfLevel
    }, 'POST');
    
    if (result && result.quizzes) {
        currentQuizzes = result.quizzes;
        currentQuizIndex = 0;
        userAnswers = new Array(currentQuizzes.length);
        
        showSection('quizSection');
        displayCurrentQuestion();
    } else {
        alert('퀴즈 생성 중 오류가 발생했습니다.');
    }
}

function displayCurrentQuestion() {
    if (currentQuizIndex >= currentQuizzes.length) {
        submitQuizAnswers();
        return;
    }
    
    const question = currentQuizzes[currentQuizIndex];
    document.getElementById('currentQuestion').textContent = question.question;
    document.getElementById('quizProgress').textContent = `${currentQuizIndex + 1}/${currentQuizzes.length}`;
    
    document.querySelectorAll('.quiz-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    if (userAnswers[currentQuizIndex] !== undefined) {
        const selectedValue = userAnswers[currentQuizIndex];
        const selectedBtn = Array.from(document.querySelectorAll('.quiz-btn'))
            .find(btn => btn.onclick.toString().includes(selectedValue.toString()));
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
        }
        document.getElementById('nextQuizBtn').disabled = false;
    } else {
        document.getElementById('nextQuizBtn').disabled = true;
    }
    
    document.getElementById('prevQuizBtn').disabled = currentQuizIndex === 0;
    document.getElementById('nextQuizBtn').textContent = 
        currentQuizIndex === currentQuizzes.length - 1 ? '결과 보기' : '다음 질문';
}

function selectAnswer(answer) {
    userAnswers[currentQuizIndex] = answer;
    
    document.querySelectorAll('.quiz-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    const selectedBtn = Array.from(document.querySelectorAll('.quiz-btn'))
        .find(btn => btn.onclick.toString().includes(answer.toString()));
    if (selectedBtn) {
        selectedBtn.classList.add('selected');
    }
    
    document.getElementById('nextQuizBtn').disabled = false;
}

function nextQuestion() {
    if (currentQuizIndex < currentQuizzes.length - 1) {
        currentQuizIndex++;
        displayCurrentQuestion();
    } else {
        submitQuizAnswers();
    }
}

function prevQuestion() {
    if (currentQuizIndex > 0) {
        currentQuizIndex--;
        displayCurrentQuestion();
    }
}

async function submitQuizAnswers() {
    for (let i = 0; i < currentQuizzes.length; i++) {
        if (userAnswers[i] === undefined) {
            alert(`${i + 1}번 문제에 답하지 않았습니다. 모든 문제에 답해주세요.`);
            currentQuizIndex = i;
            displayCurrentQuestion();
            return;
        }
    }
    
    const result = await apiCall('/submit_answers', {
        answers: userAnswers,
        correct_answers: currentQuizzes
    }, 'POST');
    
    if (result) {
        displayQuizResults(result);
        showSection('quizResultSection');
    }
}

function displayQuizResults(result) {
    document.getElementById('scorePercentage').textContent = `${Math.round(result.percentage)}%`;
    document.getElementById('scoreText').textContent = `${result.score}/${result.total}`;
    document.getElementById('assessedLevel').textContent = result.assessed_level;
    
    const resultTable = document.getElementById('resultTable');
    resultTable.innerHTML = '';
    
    result.results.forEach(item => {
        const row = document.createElement('div');
        row.className = 'result-row';
        row.innerHTML = `
            <span>문제 ${item.question_num}</span>
            <span class="result-status ${item.is_correct ? 'correct' : 'incorrect'}">
                ${item.is_correct ? '정답' : '오답'}
            </span>
        `;
        resultTable.appendChild(row);
    });
}

function showQuizResult() {
    showSection('quizResultSection');
}

async function showRecommendations() {
    const skill = document.getElementById('skillInput').value;
    const assessedLevel = document.getElementById('assessedLevel').textContent;
    
    const result = await apiCall('/recommend_courses', {
        skill, assessed_level: assessedLevel
    }, 'POST');
    
    if (result && result.recommendations) {
        displayRecommendations(result.recommendations);
        showSection('recommendationSection');
    }
}

function displayRecommendations(recommendations) {
    const courseList = document.getElementById('courseList');
    courseList.innerHTML = '';
    
    recommendations.forEach((course, index) => {
        const courseItem = document.createElement('div');
        courseItem.className = 'course-item';
        courseItem.onclick = () => selectCourse(course, courseItem);
        
        // curriculum 또는 chapters 필드 처리 (호환성)
        let curriculumData = course.curriculum || course.chapters || [];
        if (!Array.isArray(curriculumData)) {
            curriculumData = [];
        }
        
        // 표시용 텍스트
        let chaptersDisplay;
        if (curriculumData.length > 0) {
            chaptersDisplay = `${curriculumData.length}개 강의`;
        } else if (course.chapters && !Array.isArray(course.chapters)) {
            chaptersDisplay = `${course.chapters}챕터`;
        } else {
            chaptersDisplay = '강의 정보 확인';
        }
        
        courseItem.innerHTML = `
            <img src="${course.image_url}" alt="${course.title}" onerror="this.src='https://via.placeholder.com/300x200'">
            <h4>${course.title}</h4>
            <div class="course-meta">
                <span>${course.type}</span>
                <span>${course.platform || '온라인'}</span>
                <span>${chaptersDisplay}</span>
                <span>${course.duration}</span>
                <span>${course.price || '가격 미정'}</span>
            </div>
            <p class="course-summary">${course.summary}</p>
            ${curriculumData.length > 0 ? `
                <div class="course-chapters">
                    <h5>📚 강의 목차:</h5>
                    <ul class="chapters-list">
                        ${curriculumData.slice(0, 5).map(item => `<li>${item}</li>`).join('')}
                        ${curriculumData.length > 5 ? `<li class="more-chapters">...외 ${curriculumData.length - 5}개 더</li>` : ''}
                    </ul>
                </div>
            ` : ''}
            <a href="${course.link}" target="_blank" class="course-link">자세히 보기</a>
        `;
        
        courseList.appendChild(courseItem);
    });
}

function selectCourse(course, element) {
    document.querySelectorAll('.course-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    element.classList.add('selected');
    selectedCourse = course;
    
    document.getElementById('generatePlanBtn').disabled = false;
}

async function generatePlan() {
    if (!selectedCourse) {
        alert('강좌를 선택해주세요.');
        return;
    }
    
    const skill = document.getElementById('skillInput').value;
    const studyHours = document.getElementById('studyHours').value;
    const startDate = document.getElementById('startDate').value;
    const assessedLevel = document.getElementById('assessedLevel').textContent;
    
    const restDays = Array.from(document.querySelectorAll('.checkbox-group input:checked'))
        .map(cb => cb.value);
    
    const result = await apiCall('/generate_plan', {
        selected_course: selectedCourse,
        skill, study_hours: studyHours, start_date: startDate,
        rest_days: restDays, user_level: assessedLevel
    }, 'POST');
    
    if (result) {
        currentPlan = result;
        isPlanConfirmed = false;
        
        if (!currentUser.plans) currentUser.plans = [];
        currentUser.plans.push(result);
        
        showSection('calendarSection');
        
        const confirmBtn = document.getElementById('confirmPlanBtn');
        if (confirmBtn) {
            confirmBtn.style.display = 'inline-block';
        }
        
        renderCalendar();
        loadTodayTasks();
        loadReviewMaterials();
    }
}

function confirmPlan() {
    if (!currentPlan) {
        alert('계획이 없습니다.');
        return;
    }
    
    isPlanConfirmed = true;
    alert('계획이 확정되었습니다! 이제 열심히 공부해보세요! 🎯');
    
    document.getElementById('confirmPlanBtn').style.display = 'none';
    
    showHome();
}

function renderCalendar() {
    const calendarDays = document.getElementById('calendarDays');
    const monthDisplay = document.getElementById('currentMonth');
    
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', 
                       '7월', '8월', '9월', '10월', '11월', '12월'];
    monthDisplay.textContent = `${currentMonth.getFullYear()}년 ${monthNames[currentMonth.getMonth()]}`;
    
    calendarDays.innerHTML = '';
    
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        const dayDiv = createCalendarDay(date);
        calendarDays.appendChild(dayDiv);
    }
}

function createCalendarDay(date) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    
    const dateStr = formatDateToString(date);
    const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
    const isToday = dateStr === getCurrentDate();
    
    if (!isCurrentMonth) {
        dayDiv.classList.add('other-month');
    }
    
    if (isToday) {
        dayDiv.style.border = '3px solid #ff6b6b';
    }
    
    const dateNumber = document.createElement('div');
    dateNumber.className = 'date-number';
    dateNumber.textContent = date.getDate();
    dayDiv.appendChild(dateNumber);
    
    const dayTasks = findTasksForDate(dateStr);
    
    if (dayTasks.length > 0) {
        dayDiv.classList.add('has-tasks');
        
        dayTasks.slice(0, 2).forEach(task => {
            const taskPreview = document.createElement('div');
            taskPreview.className = 'task-preview';
            taskPreview.textContent = task.title;
            dayDiv.appendChild(taskPreview);
        });
        
        const completedTasks = dayTasks.filter(task => task.completed).length;
        const progress = Math.round((completedTasks / dayTasks.length) * 100);
        
        const progressDiv = document.createElement('div');
        progressDiv.className = 'progress-indicator';
        
        if (progress === 100) {
            progressDiv.innerHTML = '완료!';
            dayDiv.classList.add('fully-completed');
            
            const flowerIcon = document.createElement('div');
            flowerIcon.className = 'flower-icon';
            flowerIcon.textContent = '🌸';
            dayDiv.appendChild(flowerIcon);
        } else if (progress > 0) {
            progressDiv.textContent = `${progress}%`;
            dayDiv.classList.add('completed');
        } else {
            progressDiv.textContent = '0%';
        }
        
        dayDiv.appendChild(progressDiv);
    }
    
    dayDiv.onclick = () => openDayDetail(dateStr, dayTasks);
    
    return dayDiv;
}

function findTasksForDate(dateStr) {
    if (!currentPlan || !currentPlan.daily_schedule) return [];
    
    const dayData = currentPlan.daily_schedule.find(day => day.date === dateStr);
    return dayData ? dayData.tasks : [];
}

function openDayDetail(dateStr, tasks) {
    const modal = document.getElementById('dayDetailModal');
    const modalDate = document.getElementById('modalDate');
    const modalTaskList = document.getElementById('modalTaskList');
    
    const today = getCurrentDate();
    const isToday = dateStr === today;
    const canEdit = !isPlanConfirmed || isToday;
    
    modalDate.textContent = dateStr + (isToday ? ' (오늘)' : '');
    modalTaskList.innerHTML = '';
    
    if (tasks.length === 0) {
        modalTaskList.innerHTML = '<p>이 날짜에는 할 일이 없습니다.</p>';
    } else {
        tasks.forEach((task, index) => {
            const taskDiv = document.createElement('div');
            taskDiv.className = `modal-task-item ${task.completed ? 'completed' : ''}`;
            
            let statusMessage = '';
            if (isPlanConfirmed && !isToday) {
                statusMessage = '(계획 확정 후 오늘만 수정 가능)';
            } else if (!isToday) {
                statusMessage = '(오늘만 수정 가능)';
            }
            
            taskDiv.innerHTML = `
                <h4>${task.title}</h4>
                <p>${task.description}</p>
                <p>예상 시간: ${task.duration}</p>
                ${task.link ? `<a href="${task.link}" target="_blank">관련 링크</a>` : ''}
                <label>
                    <input type="checkbox" ${task.completed ? 'checked' : ''} 
                           ${!canEdit ? 'disabled' : ''}
                           onchange="updateTaskStatus('${dateStr}', ${index}, this.checked)">
                    완료 ${statusMessage}
                </label>
            `;
            modalTaskList.appendChild(taskDiv);
        });
    }
    
    modal.style.display = 'block';
}

function closeDayModal() {
    document.getElementById('dayDetailModal').style.display = 'none';
}

async function updateTaskStatus(dateStr, taskIndex, completed) {
    const today = getCurrentDate();
    
    if (isPlanConfirmed && dateStr !== today) {
        alert('계획 확정 후에는 오늘 날짜의 할 일만 수정할 수 있습니다.');
        return;
    }
    
    if (!isPlanConfirmed && dateStr !== today) {
        alert('오늘 날짜의 할 일만 수정할 수 있습니다.');
        return;
    }
    
    // 로컬 데이터 먼저 업데이트 (즉시 반응)
    const dayData = currentPlan.daily_schedule.find(day => day.date === dateStr);
    if (dayData && dayData.tasks[taskIndex]) {
        dayData.tasks[taskIndex].completed = completed;
    }
    
    // UI 즉시 업데이트
    renderCalendar();
    loadTodayTasks();
    
    // 서버에 비동기로 저장 (백그라운드, 로딩 화면 없음)
    try {
        const result = await apiCall('/update_task', {
            date: dateStr,
            task_index: taskIndex,
            completed: completed
        }, 'POST', false); // 로딩 화면 비활성화
        
        if (result && result.success) {
            console.log('✅ 태스크 업데이트 완료');
            checkPlanCompletion();
        } else {
            console.error('❌ 태스크 업데이트 실패');
            // 실패 시 원상복구
            if (dayData && dayData.tasks[taskIndex]) {
                dayData.tasks[taskIndex].completed = !completed;
                renderCalendar();
                loadTodayTasks();
            }
        }
    } catch (error) {
        console.error('❌ 태스크 업데이트 에러:', error);
        // 에러 시 원상복구
        if (dayData && dayData.tasks[taskIndex]) {
            dayData.tasks[taskIndex].completed = !completed;
            renderCalendar();
            loadTodayTasks();
        }
    }
}

function checkPlanCompletion() {
    if (!currentPlan || !currentPlan.daily_schedule) return;
    
    const allTasks = currentPlan.daily_schedule.flatMap(day => day.tasks);
    const completedTasks = allTasks.filter(task => task.completed);
    
    if (allTasks.length > 0 && completedTasks.length === allTasks.length) {
        setTimeout(() => {
            showCongratulations();
        }, 1000);
    }
}

async function showCongratulations() {
    const skill = document.getElementById('skillInput').value || '학습';
    
    const result = await apiCall('/recommend_next_skills', {
        completed_skill: skill
    }, 'POST');
    
    if (result && result.next_skills) {
        displayNextSkills(result.next_skills);
    }
    
    showSection('congratulationSection');
}

function displayNextSkills(skills) {
    const nextSkillsList = document.getElementById('nextSkillsList');
    nextSkillsList.innerHTML = '';
    
    skills.forEach(skill => {
        const skillDiv = document.createElement('div');
        skillDiv.className = 'next-skill-item';
        skillDiv.onclick = () => selectNextSkill(skill, skillDiv);
        skillDiv.innerHTML = `
            <h4>${skill.skill}</h4>
            <p>${skill.reason}</p>
            <span class="skill-difficulty">${skill.difficulty}</span>
        `;
        nextSkillsList.appendChild(skillDiv);
    });
}

function selectNextSkill(skill, element) {
    document.querySelectorAll('.next-skill-item').forEach(item => {
        item.classList.remove('selected');
    });
    element.classList.add('selected');
}

function startNewPlan() {
    const selectedSkill = document.querySelector('.next-skill-item.selected');
    if (selectedSkill) {
        const skillName = selectedSkill.querySelector('h4').textContent;
        document.getElementById('skillInput').value = skillName;
    }
    showCreatePlan();
}

function loadTodayTasks() {
    const today = getCurrentDate();
    const todayTasks = findTasksForDate(today);
    
    const todayTasksList = document.getElementById('todayTasksList');
    todayTasksList.innerHTML = '';
    
    if (todayTasks.length === 0) {
        todayTasksList.innerHTML = '<p>오늘은 할 일이 없습니다. 휴식을 취하세요! 🎉</p>';
        return;
    }
    
    todayTasks.forEach((task, index) => {
        const taskDiv = document.createElement('div');
        taskDiv.className = `task-item ${task.completed ? 'completed' : ''}`;
        taskDiv.innerHTML = `
            <input type="checkbox" ${task.completed ? 'checked' : ''} 
                   onchange="updateTaskStatus('${today}', ${index}, this.checked)">
            <div class="task-info">
                <div class="task-title">${task.title}</div>
                <div class="task-duration">예상 시간: ${task.duration}</div>
                ${task.link ? `<a href="${task.link}" target="_blank" class="task-link">관련 링크</a>` : ''}
            </div>
        `;
        todayTasksList.appendChild(taskDiv);
    });
}

async function loadReviewMaterials() {
    // 현재 계획이 없으면 복습 자료도 없음
    if (!currentPlan || !currentPlan.daily_schedule) {
        const reviewSection = document.getElementById('reviewMaterials');
        reviewSection.style.display = 'none';
        return;
    }
    
    const yesterday = new Date(devCurrentDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateToString(yesterday);
    
    console.log(`📚 복습 자료 로드 시도 - 어제: ${yesterdayStr}`);
    
    const yesterdayTasks = findTasksForDate(yesterdayStr);
    const completedTopics = yesterdayTasks
        .filter(task => task.completed)
        .map(task => task.title);
    
    const reviewSection = document.getElementById('reviewMaterials');
    const reviewList = document.getElementById('reviewList');
    
    if (completedTopics.length === 0) {
        reviewSection.style.display = 'block';
        reviewList.innerHTML = '<p>어제 완료한 학습 항목이 없습니다. 오늘 열심히 공부해보세요! 💪</p>';
        console.log('📚 어제 완료한 항목이 없음');
        return;
    }
    
    console.log(`📚 어제 완료한 항목: ${completedTopics.join(', ')}`);
    
    // GPT API 호출 (여기서만 호출됨)
    try {
        const result = await apiCall('/get_review_materials', {
            completed_topics: completedTopics
        }, 'POST');
        
        if (result && result.materials && result.materials.length > 0) {
            displayReviewMaterials(result.materials);
            reviewSection.style.display = 'block';
            console.log(`📚 복습 자료 ${result.materials.length}개 로드 완료`);
        } else {
            reviewSection.style.display = 'block';
            reviewList.innerHTML = '<p>복습 자료를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해보세요.</p>';
            console.log('📚 복습 자료 API 실패');
        }
    } catch (error) {
        console.error('📚 복습 자료 로드 에러:', error);
        reviewSection.style.display = 'block';
        reviewList.innerHTML = '<p>복습 자료를 불러오는 중 오류가 발생했습니다.</p>';
    }
}

function displayReviewMaterials(materials) {
    const reviewList = document.getElementById('reviewList');
    reviewList.innerHTML = '';
    
    materials.forEach(material => {
        const materialDiv = document.createElement('div');
        materialDiv.className = 'review-item';
        materialDiv.innerHTML = `
            <span class="review-type">${material.type}</span>
            <h4>${material.title}</h4>
            <p>${material.description}</p>
            <a href="${material.url}" target="_blank">보러가기</a>
        `;
        reviewList.appendChild(materialDiv);
    });
}

function changeMonth(direction) {
    currentMonth.setMonth(currentMonth.getMonth() + direction);
    renderCalendar();
}

function updateTodayDate() {
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    document.getElementById('todayDate').textContent = 
        devCurrentDate.toLocaleDateString('ko-KR', options);
}

function initDevControls() {
    const devDateInput = document.getElementById('devCurrentDate');
    devDateInput.value = getCurrentDate();
}

function prepareDateChange() {
    const devDateInput = document.getElementById('devCurrentDate');
    const newDateStr = devDateInput.value;
    
    if (newDateStr) {
        pendingDateChange = new Date(newDateStr + 'T12:00:00'); // 정오로 설정하여 시간대 문제 방지
        document.getElementById('confirmDateBtn').disabled = false;
        console.log('날짜 변경 대기 중:', newDateStr);
    }
}

function confirmDateChange() {
    if (!pendingDateChange) return;
    
    const oldDate = getCurrentDate();
    devCurrentDate = new Date(pendingDateChange);
    const newDate = getCurrentDate();
    
    alert(`날짜가 변경되었습니다: ${newDate}`);
    
    updateTodayDate();
    renderCalendar();
    loadTodayTasks();
    
    // 날짜가 바뀌었을 때만 복습 자료 새로 로드
    loadReviewMaterials();
    
    document.getElementById('confirmDateBtn').disabled = true;
    pendingDateChange = null;
    
    console.log(`날짜 변경 완료: ${oldDate} → ${newDate}`);
}

function resetToToday() {
    const oldDate = getCurrentDate();
    devCurrentDate = new Date();
    const newDate = getCurrentDate();
    
    document.getElementById('devCurrentDate').value = newDate;
    document.getElementById('confirmDateBtn').disabled = true;
    pendingDateChange = null;
    
    alert(`날짜가 오늘로 리셋되었습니다: ${newDate}`);
    
    updateTodayDate();
    renderCalendar();
    loadTodayTasks();
    
    // 날짜가 바뀌었을 때만 복습 자료 새로 로드
    loadReviewMaterials();
    
    console.log(`날짜 리셋: ${oldDate} → ${newDate}`);
}

// 날짜 관련 유틸리티 함수들 - 시간대 문제 해결
function getCurrentDate() {
    return formatDateToString(devCurrentDate);
}

function formatDateToString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function editDayTasks() {
    alert('할 일 수정 기능은 현재 개발 중입니다.');
    closeDayModal();
}

window.onclick = function(event) {
    const modal = document.getElementById('dayDetailModal');
    if (event.target === modal) {
        closeDayModal();
    }
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeDayModal();
    }
    
    if (event.key === 'Enter' && document.getElementById('quizSection').classList.contains('active')) {
        const nextBtn = document.getElementById('nextQuizBtn');
        if (!nextBtn.disabled) {
            nextQuestion();
        }
    }
});

window.addEventListener('beforeunload', function(event) {
    if (currentUser && currentPlan) {
        event.preventDefault();
        event.returnValue = '';
    }
});

console.log('Palearn JavaScript 로드 완료! 🧠✨');