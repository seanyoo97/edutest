/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TraineeApp from './TraineeApp';
import AdminApp from './AdminApp';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TraineeApp />} />
        <Route path="/admin" element={<AdminApp />} />
      </Routes>
    </Router>
  );
}
