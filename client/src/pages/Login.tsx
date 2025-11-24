import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const { login, register, googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    try {
      if (credentialResponse.credential) {
        const { needsTeam } = await googleLogin(credentialResponse.credential);
        if (needsTeam) {
          navigate('/create-team');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '구글 로그인에 실패했습니다.');
    }
  };

  const handleGoogleError = () => {
    setError('구글 로그인에 실패했습니다.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        await login(username, password);
        navigate('/dashboard');
      } else {
        await register(username, password, email);
        // 회원가입 후 팀이 없으면 팀 생성 페이지로 이동
        navigate('/create-team');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || (isLogin ? '로그인에 실패했습니다.' : '회원가입에 실패했습니다.'));
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-title">LOLPRO ONLINE</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="text"
            placeholder="사용자명"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="login-input"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="login-input"
          />
          {!isLogin && (
            <input
              type="email"
              placeholder="이메일 (선택)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="login-input"
            />
          )}
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="login-button">
            {isLogin ? '로그인' : '회원가입'}
          </button>
        </form>

        <div className="divider">
          <span>또는</span>
        </div>

        <div className="google-login-container">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            theme="filled_black"
            size="large"
            width="100%"
            text={isLogin ? 'signin_with' : 'signup_with'}
          />
        </div>

        <button
          onClick={() => {
            setIsLogin(!isLogin);
            setError('');
          }}
          className="toggle-button"
        >
          {isLogin ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
        </button>
      </div>
    </div>
  );
}

