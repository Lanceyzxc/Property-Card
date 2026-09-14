const loginForm = document.getElementById('department-login-form');
const departmentSelect = document.getElementById('login-department');
const passwordInput = document.getElementById('login-password');
const rememberInput = document.getElementById('login-remember');
const errorMessage = document.getElementById('department-login-error');
const tagDepartment = document.getElementById('tag-department');
const revealPassword = document.getElementById('reveal-password');

function normalizeDepartmentName(value) {
  const department = String(value || '').trim().toUpperCase();
  return department === 'GASS' ? 'MAIN' : department;
}

function updateDepartmentStamp() {
  tagDepartment.textContent = departmentSelect.value || 'SELECT DEPARTMENT';
  tagDepartment.classList.remove('stamp-change');
  void tagDepartment.offsetWidth;
  tagDepartment.classList.add('stamp-change');
}

const rememberedDepartment = normalizeDepartmentName(localStorage.getItem('propertyCardDepartment'));
const hasRememberedLogin = localStorage.getItem('propertyCardRememberLogin') === 'true';
if (rememberedDepartment && hasRememberedLogin) {
  departmentSelect.value = rememberedDepartment;
  rememberInput.checked = true;
  updateDepartmentStamp();
}

departmentSelect.addEventListener('change', updateDepartmentStamp);

revealPassword.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  revealPassword.textContent = isPassword ? 'HIDE' : 'SHOW';
  revealPassword.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
});

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  errorMessage.textContent = '';
  if (!departmentSelect.value || !passwordInput.value.trim()) {
    errorMessage.textContent = 'Select a department and enter its password.';
    return;
  }

  const department = normalizeDepartmentName(departmentSelect.value);
  const expectedPassword = `${department.toLowerCase()}2026`;
  if (passwordInput.value.trim() !== expectedPassword) {
    errorMessage.textContent = `Incorrect password for ${departmentSelect.value}.`;
    passwordInput.value = '';
    passwordInput.focus();
    return;
  }

  if (rememberInput.checked) {
    localStorage.setItem('propertyCardDepartment', department);
    localStorage.setItem('propertyCardRememberLogin', 'true');
  } else {
    localStorage.removeItem('propertyCardDepartment');
    localStorage.removeItem('propertyCardRememberLogin');
  }
  sessionStorage.setItem('propertyCardDepartment', department);
  window.location.replace('index.html');
});