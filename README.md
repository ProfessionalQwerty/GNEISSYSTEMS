# GNEISS

Linters catch syntax. Nothing catches architecture. GNEISS does.

A CLI tool that parses Java imports into a dependency graph and runs a 
GNN-FiLM pipeline over it to surface structural decay — cyclic 
dependencies, tight coupling, architectural rot — before it becomes 
a rewrite.



https://github.com/user-attachments/assets/e5c6a0b3-79e3-4f21-82e0-1b1d1ad6e37a




## Installation

# Windows
irm https://raw.githubusercontent.com/ProfessionalQwerty/GNEISSYSTEMS/main/install.ps1 | iex

# Mac
curl -fsSL https://raw.githubusercontent.com/ProfessionalQwerty/GNEISSYSTEMS/main/install.sh | bash

## Usage

gneiss auth        # authenticate via GitHub
gneiss audit ./src # scan a Java project

## License
MIT
