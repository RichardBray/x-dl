import { Routes, Route } from 'react-router-dom';
import { Nav } from './components/Nav';
import { DownloadPage } from './pages/DownloadPage';
import { ArticlePage } from './pages/ArticlePage';
import './App.css';

function App() {
  return (
    <div className="app">
      <Nav />
      <Routes>
        <Route path="/" element={<DownloadPage />} />
        <Route path="/article" element={<ArticlePage />} />
      </Routes>
    </div>
  );
}

export default App;
