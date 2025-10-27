import React from 'react';

const Navbar: React.FC = () => {
    return (
        <nav>
            <ul>
                <li><a href="/">Dashboard</a></li>
                <li><a href="/camera">Camera View</a></li>
                <li><a href="/settings">Settings</a></li>
            </ul>
        </nav>
    );
};

export default Navbar;