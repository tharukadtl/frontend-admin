import { render, screen } from '@testing-library/react';
import App from './App';

// Was the unmodified create-react-app boilerplate ("renders learn react link"), asserting text
// this real app has never contained — left over from scaffolding, not adapted when the app was
// built out. With no route set, <App /> lands on its default (unauthenticated) route, the real
// login page, so this now asserts on what's actually rendered instead.
test('renders the login page by default when unauthenticated', () => {
  render(<App />);
  expect(screen.getByRole('button', {name: /sign in/i})).toBeInTheDocument();
});
