import { render, screen } from '@testing-library/react';
import DashboardPage from './DashboardPage.jsx';

describe('DashboardPage', () => {
  it('shows a safe error instead of crashing on an incomplete API response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

    render(<DashboardPage onProducts={jest.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Dashboard data is invalid. Please refresh the page.');
  });
});
