const loginForm = document.getElementById('department-login-form');
const departmentSelect = document.getElementById('login-department');
const passwordInput = document.getElementById('login-password');
const rememberInput = document.getElementById('login-remember');
const errorMessage = document.getElementById('department-login-error');

function normalizeDepartmentName(value) {
  const department = String(value || '').trim().toUpperCase();
  if (department === 'GASS') return 'MAIN';
  return department === 'IABD' ? 'ENTIENZA' : department;
}

const rememberedDepartment = normalizeDepartmentName(localStorage.getItem('propertyCardDepartment'));
const hasRememberedLogin = localStorage.getItem('propertyCardRememberLogin') === 'true';
if (rememberedDepartment && hasRememberedLogin && departmentSelect) {
  departmentSelect.value = rememberedDepartment;
  if (rememberInput) rememberInput.checked = true;
}

loginForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  errorMessage.textContent = '';
  if (!departmentSelect.value || !passwordInput.value.trim()) {
    errorMessage.textContent = 'Please select a department and enter your password.';
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

  if (rememberInput?.checked) {
    localStorage.setItem('propertyCardDepartment', department);
    localStorage.setItem('propertyCardRememberLogin', 'true');
  } else {
    localStorage.removeItem('propertyCardDepartment');
    localStorage.removeItem('propertyCardRememberLogin');
  }
  sessionStorage.setItem('propertyCardDepartment', department);
  window.location.replace('index.html');
});
