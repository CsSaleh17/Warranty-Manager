import { render, screen } from '@testing-library/react';
import App from './App.jsx';

describe('App', () => {
  it('renders the application name', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Warranty Manager' })).toBeInTheDocument();
  });
});
