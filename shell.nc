mem command 255 end     // uint8_t command[];
mem siginfo 128 end     // siginfo_t info;

start:
    STDOUT "# " 2 write drop    // write(STDOUT, "# ", 2);
    STDIN command 255 read      // count = read(STDIN, command, 255);
    1 - command + 0 @8          // *((u8*)command+(count - 1)) = 0;

    fork                        // pid_t pid = fork();
    0 == if                     // if(pid == 0) {
        command 0 0 execve      // execve(command, NULL, NULL)
        goto finished           // continue;
    else                        // } else {
        P_ALL 0 siginfo WEXITED waitid // waitid(P_ALL, 0, &info, WEXITED);
    end                         // }

    start goto
finished:
    0 exit