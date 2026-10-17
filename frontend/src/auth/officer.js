import felixPhoto from '../assets/felix.png';

// Mock data until a backend exists.
export const OFFICER = {
  id: 'felix',
  name: 'Hoang',
  role: 'Extension Officer',
  email: 'felix@welthungerhilfe.de',
  region: 'Field District North',
  assignedFarmers: 20,
  photo: felixPhoto,
};

// Demo credentials — replace with a real auth call later.
const DEMO_PASSWORD = 'demo';

export function signIn(login, password) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const id = login.trim().toLowerCase();
      const knownLogin = id === OFFICER.id || id === OFFICER.email;
      if (knownLogin && password === DEMO_PASSWORD) {
        resolve(OFFICER);
      } else {
        reject(new Error('Officer ID or password is not correct.'));
      }
    }, 600);
  });
}
