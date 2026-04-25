import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedDriverPhone, setLinkedDriverPhone] = useState('');
  const { register, error } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register({ email, password, phone, linkedDriverPhone });
      navigate('/monitoring');
    } catch (err) {
      // Error handled in context
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Family Registration</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="Enter your email"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="Choose a strong password"
            />
          </div>
          <div className="form-group">
            <label>Your Phone Number</label>
            <input 
              type="tel" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              required 
              placeholder="Your phone number"
            />
          </div>
          <div className="form-group">
            <label>Driver's Phone (To Monitor)</label>
            <input 
              type="tel" 
              value={linkedDriverPhone} 
              onChange={(e) => setLinkedDriverPhone(e.target.value)} 
              required 
              placeholder="Driver's phone number"
            />
          </div>
          <button type="submit" className="btn-primary">Register</button>
        </form>
        <p className="auth-link">Already have an account? <Link to="/login">Login here</Link></p>
      </div>
    </div>
  );
};

export default RegisterPage;
