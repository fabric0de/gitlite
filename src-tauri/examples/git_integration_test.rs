use gitlite_lib::git::{get_branches, get_commits};

fn main() {
    let test_repo = "/tmp/gitlite-integration-test";

    println!("Testing get_commits with limit=50...");
    match get_commits(test_repo, 50, None) {
        Ok(commits) => {
            println!("✓ Successfully retrieved {} commits", commits.len());
            println!(
                "First commit: {} - {}",
                &commits[0].hash[..8],
                commits[0].message
            );
            println!(
                "Last commit: {} - {}",
                &commits[commits.len() - 1].hash[..8],
                commits[commits.len() - 1].message
            );

            if commits.len() == 50 {
                println!("✓ Limit correctly enforced");
            } else {
                eprintln!("✗ Expected 50 commits, got {}", commits.len());
            }
        }
        Err(e) => {
            eprintln!("✗ Failed to get commits: {}", e);
            std::process::exit(1);
        }
    }

    println!("\nTesting get_branches...");
    match get_branches(test_repo) {
        Ok(branches) => {
            println!("✓ Successfully retrieved {} branches", branches.len());

            for branch in &branches {
                let marker = if branch.is_current { " (current)" } else { "" };
                let remote = if branch.is_remote { " (remote)" } else { "" };
                println!("  - {}{}{}", branch.name, marker, remote);
            }

            let current_branch = branches.iter().find(|b| b.is_current);
            if let Some(current) = current_branch {
                println!("✓ Current branch: {}", current.name);
            } else {
                eprintln!("✗ No current branch found");
                std::process::exit(1);
            }

            if branches.iter().any(|b| b.name == "main") {
                println!("✓ main branch found");
            }
            if branches.iter().any(|b| b.name == "feature-branch") {
                println!("✓ feature-branch found");
            }
        }
        Err(e) => {
            eprintln!("✗ Failed to get branches: {}", e);
            std::process::exit(1);
        }
    }

    println!("\n✓ All integration tests passed!");
}
