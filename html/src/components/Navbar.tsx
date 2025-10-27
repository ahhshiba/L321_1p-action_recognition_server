import React from 'react';
import { Link } from 'react-router-dom';

const Navbar: React.FC = () => {
    return (
        <header style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}>
            <nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Link to="/">首頁</Link>
                <Link to="/camera">攝影機</Link>
                <Link to="/settings">設定</Link>
            </nav>
        </header>
    );
};

export default Navbar;